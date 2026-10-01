/**
 * The Docs Index: the player docs split into sections, with contents, keyword search and lookup by id. It
 * needs no network and no model. Section ids are `<page>#<anchor>`, with the wiki's anchor rule.
 */
import { docHeadings, type DocHeading } from './headingAnchors';
import type { DocsPages } from './docsChecks';
import { sectionParts } from './sectionParts';

/** The most characters one section holds, so a few sections fit a small model's context. */
export const SECTION_CHAR_LIMIT = 6000;

/** The level a page splits at before the size limit applies: `#` and `##` each start a section. */
const BASE_SPLIT_LEVEL = 2;

export interface DocSection {
  /**
   * `<page>#<anchor>`, or the page name for text above its first heading. Part 2 and later of a split
   * section add `-part-N`; those ids and the built changelog ids are index-only, so no wiki link uses them.
   */
  id: string;
  page: string;
  /** The heading's text with inline markdown removed. */
  heading: string;
  /** The heading, plus "(Part N)" for a part of a split section: the name a player sees. */
  label: string;
  /** The headings above this one on its page, outermost first, as plain text. */
  trail: string[];
  /** The section's source, heading line included. */
  markdown: string;
}

export interface DocsContentsPage {
  page: string;
  /** The page's `#` heading as plain text, or the page name when it has none. */
  title: string;
  sections: { id: string; label: string; level: number }[];
}

export interface DocsIndex {
  /** Every page with its sections, in sidebar order; pages the sidebar does not list come last. */
  contents(): DocsContentsPage[];
  /** Sections ranked by keyword match, best first; empty when no word of the query matches. */
  search(query: string, limit?: number): DocSection[];
  /**
   * The sections with these ids, in the order asked; unknown ids are skipped. The id of a split section
   * returns all its parts in order.
   */
  get(ids: readonly string[]): DocSection[];
}

const MARKDOWN_LINK = /!?\[([^\]]*)\]\([^)]*\)/g;

/** A heading's source text as a reader sees it. */
function plainText(text: string): string {
  return text.replace(MARKDOWN_LINK, '$1').replace(/[*`]/g, '').trim();
}

/** A section with its heading level (0 for text above the page's first heading) and its base id. */
export interface SplitSection extends DocSection {
  level: number;
  /** The id of the whole section; equal to `id` unless this is part 2 or later. */
  baseId: string;
}

/**
 * Splits one page into sections at `#` and `##`. A section over the limit splits at its sub-headings, and
 * a section with none splits into parts at block boundaries.
 */
export function splitPage(page: string, markdown: string): SplitSection[] {
  const lines = markdown.split(/\r?\n/);
  const headings = docHeadings(markdown);
  const sections: SplitSection[] = [];
  const textOf = (from: number, to: number) => lines.slice(from, to).join('\n').trimEnd();
  const trailOf = (index: number): string[] => {
    const trail: string[] = [];
    let level = headings[index].level;
    for (let i = index - 1; i >= 0; i--) {
      if (headings[i].level < level) {
        trail.unshift(plainText(headings[i].text));
        level = headings[i].level;
      }
    }
    return trail;
  };
  const push = (heading: DocHeading | null, index: number, text: string) => {
    if (heading === null && text.trim() === '') return;
    const baseId = heading ? `${page}#${heading.anchor}` : page;
    const name = heading ? plainText(heading.text) : page;
    const parts = sectionParts(text, heading !== null, SECTION_CHAR_LIMIT);
    parts.forEach((part, k) => {
      sections.push({
        id: k === 0 ? baseId : `${baseId}-part-${k + 1}`,
        baseId,
        page,
        heading: name,
        label: parts.length > 1 ? `${name} (Part ${k + 1})` : name,
        trail: heading ? trailOf(index) : [],
        markdown: part,
        level: heading?.level ?? 0,
      });
    });
  };
  /** Emits headings[first..last) as sections; each starts at its heading and ends at the next one kept. */
  const emit = (first: number, last: number, end: number, splitLevel: number) => {
    const starts: number[] = [];
    for (let i = first; i < last; i++) if (i === first || headings[i].level <= splitLevel) starts.push(i);
    starts.forEach((start, k) => {
      const next = k + 1 < starts.length ? starts[k + 1] : last;
      const to = next < last ? headings[next].line : end;
      const text = textOf(headings[start].line, to);
      const deeper = headings.slice(start + 1, next).map((h) => h.level);
      if (text.length <= SECTION_CHAR_LIMIT || deeper.length === 0) {
        push(headings[start], start, text);
        return;
      }
      // Too long: the heading keeps its intro, and each next-level sub-heading starts its own section.
      emit(start, next, to, Math.min(...deeper));
    });
  };
  const firstLine = headings[0]?.line ?? lines.length;
  push(null, -1, textOf(0, firstLine));
  if (headings.length > 0) emit(0, headings.length, lines.length, BASE_SPLIT_LEVEL);
  return sections;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is',
  'it', 'me', 'my', 'of', 'on', 'or', 'so', 'that', 'the', 'this', 'to', 'what', 'when', 'where', 'which',
  'why', 'with', 'you', 'your',
]);

/** Folds a plural to its singular, so "blueprints" finds "Blueprint". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(?:ch|sh|x|z|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** The search terms of a text: lowercase words and numbers, stop words dropped, plurals folded. */
export function searchTerms(text: string): string[] {
  const words = text.replace(MARKDOWN_LINK, '$1').toLowerCase().match(/[\p{L}\p{N}]+(?:\.\p{N}+)*/gu) ?? [];
  return words.filter((word) => !STOP_WORDS.has(word)).map(stem);
}

/** How much a query term in the section's own heading outweighs one body hit. */
const HEADING_WEIGHT = 4;
/** How much a query term in a heading above the section counts. */
const TRAIL_WEIGHT = 1;
/** BM25's term-frequency saturation and length normalization for body text. */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const DEFAULT_SEARCH_LIMIT = 5;

interface Ranked {
  section: SplitSection;
  heading: Set<string>;
  trail: Set<string>;
  body: Map<string, number>;
  length: number;
}

function counts(terms: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const term of terms) map.set(term, (map.get(term) ?? 0) + 1);
  return map;
}

/** The sidebar's page links in order. */
function sidebarOrder(sidebar: string): string[] {
  return [...sidebar.matchAll(/\]\(([^)#\s]+)\)/g)].map((m) => m[1]).filter((href) => !/^[a-z]+:/i.test(href));
}

export interface DocsIndexInput {
  pages: DocsPages;
  /** The wiki's sidebar page, which sets the page order. */
  sidebar?: string;
}

/** Builds a Docs Index over the given pages. */
export function createDocsIndex({ pages, sidebar = '' }: DocsIndexInput): DocsIndex {
  const order = sidebarOrder(sidebar);
  const rank = (page: string) => (order.includes(page) ? order.indexOf(page) : order.length);
  const pageNames = Object.keys(pages).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const byPage = new Map(pageNames.map((page) => [page, splitPage(page, pages[page])]));
  const all = [...byPage.values()].flat();
  const byId = new Map(all.map((section) => [section.id, section]));

  const ranked: Ranked[] = all.map((section) => {
    const lines = section.markdown.split('\n');
    const bodyTerms = searchTerms(section.level > 0 ? lines.slice(1).join('\n') : section.markdown);
    return {
      section,
      heading: new Set(section.level > 0 ? searchTerms(section.heading) : []),
      trail: new Set(section.trail.flatMap(searchTerms)),
      body: counts(bodyTerms),
      length: bodyTerms.length,
    };
  });
  const averageLength = ranked.reduce((sum, r) => sum + r.length, 0) / Math.max(ranked.length, 1);
  const documentFrequency = new Map<string, number>();
  for (const r of ranked) {
    for (const term of new Set([...r.heading, ...r.trail, ...r.body.keys()])) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  return {
    contents: () =>
      pageNames.map((page) => {
        const sections = byPage.get(page) ?? [];
        const top = sections.find((s) => s.level === 1);
        return {
          page,
          title: top?.heading ?? page,
          sections: sections.map(({ id, label, level }) => ({ id, label, level })),
        };
      }),
    search: (query, limit = DEFAULT_SEARCH_LIMIT) => {
      const terms = [...new Set(searchTerms(query))];
      if (terms.length === 0) return [];
      const scored = ranked.map((r) => {
        let score = 0;
        let matched = 0;
        for (const term of terms) {
          const tf = r.body.get(term) ?? 0;
          const inHeading = r.heading.has(term);
          const inTrail = r.trail.has(term);
          if (tf === 0 && !inHeading && !inTrail) continue;
          matched++;
          const df = documentFrequency.get(term) ?? 0;
          const idf = Math.log(1 + (ranked.length - df + 0.5) / (df + 0.5));
          const body = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + (BM25_B * r.length) / averageLength));
          score += idf * (body + (inHeading ? HEADING_WEIGHT : 0) + (inTrail ? TRAIL_WEIGHT : 0));
        }
        // A section that matches more of the query's words ranks above one that repeats a single word.
        return { section: r.section, score: score * (matched / terms.length) ** 2 };
      });
      return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => publicSection(s.section));
    },
    get: (ids) => ids.flatMap((id) => {
      const section = byId.get(id);
      if (!section) return [];
      return (section.id === section.baseId ? all.filter((s) => s.baseId === id) : [section]).map(publicSection);
    }),
  };
}

function publicSection({ id, page, heading, label, trail, markdown }: SplitSection): DocSection {
  return { id, page, heading, label, trail, markdown };
}
