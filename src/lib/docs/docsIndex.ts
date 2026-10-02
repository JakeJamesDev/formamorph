/**
 * The Docs Index: the player docs split into sections, with contents, keyword search and lookup by id. It
 * needs no network and no model. Section ids are `<page>#<anchor>`, with the wiki's anchor rule.
 */
import { stemmer } from 'stemmer';
import { docHeadings, forEachProseLine, KEYWORD_LINE, MARKDOWN_LINK, plainText, type DocHeading } from './headingAnchors';
import type { DocsPages } from './docsChecks';
import { sectionParts } from './sectionParts';

/** The most characters one section holds, so a few sections fit a small model's context. */
export const SECTION_CHAR_LIMIT = 6000;

/** The level a page splits at before the size limit applies: `#` and `##` each start a section. */
const BASE_SPLIT_LEVEL = 2;

export interface DocSection {
  /** `<page>#<anchor>`, or the page name for text above its first heading; part N of a split section adds `-part-N`. */
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
  /**
   * Sections ranked by keyword match, best first, with every guide hit above every changelog hit. A question
   * about what is new leads with the newest release's sections, or those of the release it names, matched or
   * not. Empty when the query asks nothing new and no word of it matches. A section of `favor.page` scores
   * twice its match strength.
   */
  search(query: string, limit?: number, favor?: { page: string }): DocSection[];
  /**
   * The sections with these ids, in the order asked; unknown ids are skipped. The id of a split section
   * returns all its parts in order.
   */
  get(ids: readonly string[]): DocSection[];
}

/** A section with its heading level (0 for text above the page's first heading) and its base id. */
interface SplitSection extends DocSection {
  level: number;
  /** The id of the whole section; equal to `id` unless this is part 2 or later. */
  baseId: string;
  /** The lists of the keyword lines in the section's text, which its markdown leaves out. */
  keywords: string[];
}

/** A section's text without its keyword lines, and their lists. A blank line the removal doubles goes too. */
function takeKeywordLines(text: string): { text: string; keywords: string[] } {
  const lines = text.split('\n');
  const drop = new Set<number>();
  const keywords: string[] = [];
  forEachProseLine(text, (source, line) => {
    const match = KEYWORD_LINE.exec(source);
    if (!match) return;
    keywords.push(match[1]);
    drop.add(line);
    if (lines[line - 1]?.trim() === '' && lines[line + 1]?.trim() === '') drop.add(line + 1);
  });
  if (drop.size === 0) return { text, keywords };
  return { text: lines.filter((_, i) => !drop.has(i)).join('\n').trimEnd(), keywords };
}

/**
 * Splits one page into sections at `#` and `##`. A section over the limit splits at its sub-headings, and
 * a section with none splits into parts at block boundaries.
 */
function splitPage(page: string, markdown: string): SplitSection[] {
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
  const addSection = (heading: DocHeading | null, index: number, source: string) => {
    if (heading === null && source.trim() === '') return;
    const baseId = heading ? `${page}#${heading.anchor}` : page;
    const name = heading ? plainText(heading.text) : page;
    const { text, keywords } = takeKeywordLines(source);
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
        keywords,
      });
    });
  };
  /** Emits headings[first..last) as sections; each starts at its heading and ends at the next one kept. */
  const splitAtHeadings = (first: number, last: number, end: number, splitLevel: number) => {
    const starts: number[] = [];
    for (let i = first; i < last; i++) if (i === first || headings[i].level <= splitLevel) starts.push(i);
    starts.forEach((start, k) => {
      const next = k + 1 < starts.length ? starts[k + 1] : last;
      const to = next < last ? headings[next].line : end;
      const text = textOf(headings[start].line, to);
      const deeper = headings.slice(start + 1, next).map((h) => h.level);
      if (text.length <= SECTION_CHAR_LIMIT || deeper.length === 0) {
        addSection(headings[start], start, text);
        return;
      }
      // Too long: the heading keeps its intro, and each next-level sub-heading starts its own section.
      splitAtHeadings(start, next, to, Math.min(...deeper));
    });
  };
  const firstLine = headings[0]?.line ?? lines.length;
  addSection(null, -1, textOf(0, firstLine));
  if (headings.length > 0) splitAtHeadings(0, headings.length, lines.length, BASE_SPLIT_LEVEL);
  return sections;
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is',
  'it', 'me', 'my', 'of', 'on', 'or', 'so', 'that', 'the', 'this', 'to', 'what', 'when', 'where', 'which',
  'why', 'with', 'you', 'your',
]);

/** Words of a question that carry no topic: the screen the player means, or how they phrase looking. */
const NO_WORDS: ReadonlySet<string> = new Set();

const FILLER_WORDS: ReadonlySet<string> = new Set(['am', 'here', 'looking', 'there', 'these', 'those']);

/** A word, a number, or a hyphenated run of them. */
const WORD = /[\p{L}\p{N}]+(?:\.\p{N}+)*(?:-[\p{L}\p{N}]+)*/gu;

/** A text's words, lowercased and space-padded, so a whole-word phrase test is `includes`. */
function wordsOf(text: string): string {
  return ` ${(text.toLowerCase().match(WORD) ?? []).join(' ')} `;
}

/**
 * A text's Porter-stemmed words and numbers, stop words dropped; a hyphenated word also gives its joined
 * form. The `filler` words drop too.
 */
function searchTerms(text: string, filler: ReadonlySet<string>): string[] {
  const words = text.replace(MARKDOWN_LINK, '$1').toLowerCase().match(WORD) ?? [];
  return words
    .flatMap((word) => (word.includes('-') ? [...word.split('-'), word.replace(/-/g, '')] : [word]))
    .filter((word) => !STOP_WORDS.has(word) && !filler.has(word))
    .map((word) => stemmer(word));
}

/** How much a query term in the section's own heading outweighs one body hit. */
const HEADING_WEIGHT = 4;
/** How much a query term in a heading above the section counts. */
const TRAIL_WEIGHT = 1;
/** How much a section of the favored page outweighs a match of the same strength on another page. */
const FAVORED_PAGE_WEIGHT = 2;
/** BM25's term-frequency saturation and length normalization for body text. */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const DEFAULT_SEARCH_LIMIT = 5;

/** The page that holds the released changelog sections, newest first (see `changelogSlice.ts`). */
const CHANGELOG_PAGE = 'Changelog';

/** A version number such as 3.1 or 3.1.2. */
const VERSION = /\d+\.\d+(?:\.\d+)?/;

const RELEASE_WORD = String.raw`(?:updates?|versions?|releases?|patch(?:es)?|builds?|formamorph|(?:the|this) (?:app|game)|v?\d+\.\d+(?:\.\d+)?)`;
const RECENT_WORD = String.raw`(?:latest|newest|last|recent|new|current)`;
const WHAT_NEW = String.raw`what(?:'?s| is| are)? new`;
const WHAT_CHANGED = String.raw`what(?:'?s| has| have| was| were| got| did)?(?: been| get)? (?:changed|fixed|added|removed|different|change|fix|add|remove)`;

/**
 * Questions that ask what is new, changed or fixed. A "what changed" phrase needs a release word after it or
 * nothing else, so "what is different between two stats?" is a guide question.
 */
const WHATS_NEW = [
  new RegExp(String.raw`^(?:so |ok |okay |hey |hi )?(?:${WHAT_NEW}|${WHAT_CHANGED}|anything new|any new features|new features|recent changes|(?:patch|release|update) notes)$`),
  new RegExp(String.raw`\b(?:${WHAT_NEW}|${WHAT_CHANGED})\b.*\b(?:in|with|since|for) (?:the |this |that )?(?:${RECENT_WORD} )?${RELEASE_WORD}\b`),
  new RegExp(String.raw`^(?!.*\b(?:how|install|download|get)\b).*\bwhat\b.*\b(?:latest|newest|last|recent) (?:update|version|release|patch)\b`),
  new RegExp(String.raw`\b(?:patch|release|update) notes\b|\b(?:recent )?changes in (?:the )?${RECENT_WORD} ${RELEASE_WORD}\b`),
  // A listing's or a world's changelog is a guide topic.
  /^(?!.*\b(?:listings?|worlds?|publish\w*|creations?)\b).*\bchangelog\b/,
];

/** Whether the query asks what is new, and the version it names, if any. */
function readWhatsNew(query: string): { version: string | null } | null {
  const text = query.toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}'.\s]+/gu, ' ').replace(/\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!WHATS_NEW.some((pattern) => pattern.test(text))) return null;
  return { version: VERSION.exec(text)?.[0] ?? null };
}

/** One released version and its changelog sections that hold text, in page order. */
interface Release {
  version: string;
  sections: SplitSection[];
}

/** The changelog's releases, newest first: each `##` section and the sections under it, heading-only ones left out. */
function releasesOf(changelog: readonly SplitSection[]): Release[] {
  const releases: Release[] = [];
  for (const section of changelog) {
    if (section.level === 2) releases.push({ version: VERSION.exec(section.heading)?.[0] ?? '', sections: [] });
    if (section.level >= 2 && section.markdown.replace(/^#{1,6}\s.*(?:\n|$)/, '').trim()) releases.at(-1)?.sections.push(section);
  }
  return releases;
}

/** One section's search terms, by where they appear. */
interface SectionTerms {
  section: SplitSection;
  /** Terms of the section's heading and keyword lines, filler words included. */
  heading: Set<string>;
  /** The heading and keyword phrases that hold a filler word, with their terms. A query that holds one whole counts its terms. */
  fillerPhrases: { phrase: string; terms: string[] }[];
  trail: Set<string>;
  body: Map<string, number>;
  length: number;
}

function termCounts(terms: string[]): Map<string, number> {
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
  /** Whether the search ignores filler words such as "here" in a question. On unless `false`. */
  fillerWords?: boolean;
}

/** Builds a Docs Index over the given pages. */
export function createDocsIndex({ pages, sidebar = '', fillerWords = true }: DocsIndexInput): DocsIndex {
  const filler = fillerWords ? FILLER_WORDS : NO_WORDS;
  const order = sidebarOrder(sidebar);
  const rank = (page: string) => (order.includes(page) ? order.indexOf(page) : order.length);
  const pageNames = Object.keys(pages).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const byPage = new Map(pageNames.map((page) => [page, splitPage(page, pages[page])]));
  const all = [...byPage.values()].flat();
  const byId = new Map(all.map((section) => [section.id, section]));
  const releases = releasesOf(byPage.get(CHANGELOG_PAGE) ?? []);
  const isChangelog = (section: SplitSection) => section.page === CHANGELOG_PAGE;
  /** The sections a what's-new question leads with: the named release's, or else the newest one's. */
  const releaseLead = ({ version }: { version: string | null }): SplitSection[] =>
    (version ? releases.find((release) => release.version === version || release.version.startsWith(`${version}.`)) : releases[0])?.sections ?? [];

  const sectionTerms: SectionTerms[] = all.map((section) => {
    const lines = section.markdown.split('\n');
    const bodyTerms = searchTerms(section.level > 0 ? lines.slice(1).join('\n') : section.markdown, filler);
    const phrases = [...(section.level > 0 ? [section.heading] : []), ...section.keywords.flatMap((list) => list.split(','))]
      .map((phrase) => phrase.trim().toLowerCase())
      .filter(Boolean);
    return {
      section,
      // A heading keeps its filler words, so a control named "Here" still matches itself.
      heading: new Set(phrases.flatMap((phrase) => searchTerms(phrase, NO_WORDS))),
      fillerPhrases: phrases
        .filter((phrase) => (phrase.match(WORD) ?? []).some((word) => filler.has(word)))
        .map((phrase) => ({ phrase, terms: searchTerms(phrase, NO_WORDS) })),
      trail: new Set(section.trail.flatMap((heading) => searchTerms(heading, filler))),
      body: termCounts(bodyTerms),
      length: bodyTerms.length,
    };
  });
  const averageLength = sectionTerms.reduce((sum, r) => sum + r.length, 0) / Math.max(sectionTerms.length, 1);
  const documentFrequency = new Map<string, number>();
  for (const r of sectionTerms) {
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
    search: (query, limit = DEFAULT_SEARCH_LIMIT, favor) => {
      const queryTerms = [...new Set(searchTerms(query, filler))];
      if (queryTerms.length === 0) return [];
      const asked = wordsOf(query);
      const scored = sectionTerms.map((r) => {
        // A section whose own name holds a filler word still matches that name when the query holds it whole.
        const named = r.fillerPhrases.filter(({ phrase }) => asked.includes(wordsOf(phrase))).flatMap(({ terms }) => terms);
        const terms = [...new Set([...queryTerms, ...named])];
        let score = 0;
        let matched = 0;
        for (const term of terms) {
          const tf = r.body.get(term) ?? 0;
          const inHeading = r.heading.has(term);
          const inTrail = r.trail.has(term);
          if (tf === 0 && !inHeading && !inTrail) continue;
          matched++;
          const df = documentFrequency.get(term) ?? 0;
          const idf = Math.log(1 + (sectionTerms.length - df + 0.5) / (df + 0.5));
          const body = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + (BM25_B * r.length) / averageLength));
          score += idf * (body + (inHeading ? HEADING_WEIGHT : 0) + (inTrail ? TRAIL_WEIGHT : 0));
        }
        // A section that matches more of the query's words ranks above one that repeats a single word.
        const weight = r.section.page === favor?.page ? FAVORED_PAGE_WEIGHT : 1;
        return { section: r.section, score: score * (matched / terms.length) ** 2 * weight };
      });
      const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.section);
      const whatsNew = readWhatsNew(query);
      const lead = whatsNew ? releaseLead(whatsNew) : [];
      const ranked = [...lead, ...hits.filter((section) => !isChangelog(section)), ...hits.filter((section) => isChangelog(section) && !lead.includes(section))];
      return ranked.slice(0, limit).map(publicSection);
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
