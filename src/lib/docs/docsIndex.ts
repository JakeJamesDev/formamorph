/**
 * The Docs Index: the player docs split into sections, with contents, keyword search and lookup by id. It
 * needs no network and no model. Section ids are `<page>#<anchor>`, with the wiki's anchor rule.
 */
import { stemmer } from 'stemmer';
import { docHeadings, forEachProseLine, KEYWORD_LINE, MARKDOWN_LINK, plainText, ROUTE_LINE, routeParts, type DocHeading } from './headingAnchors';
import type { DocsPages } from './docsChecks';
import { docsHrefs, docTargetId, hrefParts } from './docsLinks';
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
  /** The surface id its route line names: where a player does what the section explains. Absent without a line. */
  route?: string;
  /** The target its route line names after `#`: the control the section's steps end at. */
  target?: string;
}

export interface DocsContentsPage {
  page: string;
  /** The page's `#` heading as plain text, or the page name when it has none. */
  title: string;
  sections: { id: string; label: string; level: number }[];
}

export interface DocsSearchOptions {
  /** The question comes from an open screen, so "window", "panel", "dialog", "screen" and "tab" name that screen and the search ignores them. */
  onSurface?: boolean;
  /** The least share of the first ranked hit's score another hit needs, from 0 to 1; that hit and what's-new lead sections stay. */
  floor?: number;
}

export interface DocsIndex {
  /** Every page with its sections, in sidebar order; pages the sidebar does not list come last. */
  contents(): DocsContentsPage[];
  /**
   * Sections ranked by keyword match, best first, with every guide hit above every changelog hit. A question
   * about what is new leads with the newest release's sections, or those of the release it names, matched or
   * not. Empty when the query asks nothing new and no word of it matches. A section of `favor.page` scores
   * twice its match strength. A hub section, one that links to many other pages, scores half unless the query
   * holds its heading as a phrase.
   */
  search(query: string, limit?: number, favor?: { page: string }, options?: DocsSearchOptions): DocSection[];
  /** The release sections a question about what is new leads with, in page order. Empty for any other question. */
  whatsNew(query: string): DocSection[];
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
  /** The first route line's surface id; the markdown leaves the line out. */
  route?: string;
  /** The first route line's target, when it names one. */
  target?: string;
}

/**
 * A section's text without its keyword and route lines, and what they held. A blank line the removal doubles
 * goes too. A route line under a sub-heading the section holds is not the section's: it stays in the text.
 */
function takeTagLines(text: string): { text: string; keywords: string[]; route?: string; target?: string } {
  const lines = text.split('\n');
  const drop = new Set<number>();
  const keywords: string[] = [];
  let routeValue: string | undefined;
  const subHeading = docHeadings(text).find((heading) => heading.line > 0)?.line ?? Infinity;
  forEachProseLine(text, (source, line) => {
    const keyword = KEYWORD_LINE.exec(source);
    const routeLine = line < subHeading ? ROUTE_LINE.exec(source) : null;
    if (keyword) keywords.push(keyword[1]);
    else if (routeLine) routeValue ||= routeLine[1] || undefined;
    else return;
    drop.add(line);
    if (lines[line - 1]?.trim() === '' && lines[line + 1]?.trim() === '') drop.add(line + 1);
  });
  if (drop.size === 0) return { text, keywords };
  const { surface, target } = routeParts(routeValue ?? '');
  return { text: lines.filter((_, i) => !drop.has(i)).join('\n').trimEnd(), keywords, route: surface || undefined, target: target || undefined };
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
    const baseId = docTargetId({ page, anchor: heading?.anchor });
    const name = heading ? plainText(heading.text) : page;
    const { text, keywords, route, target } = takeTagLines(source);
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
        route,
        target,
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
      if (takeTagLines(text).text.length <= SECTION_CHAR_LIMIT || deeper.length === 0) {
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

/** Words that name the open screen when the player asks about it: "what does this window do?". */
const SCREEN_WORDS: ReadonlySet<string> = new Set(['window', 'panel', 'dialog', 'screen', 'tab']);

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
export const FAVORED_PAGE_WEIGHT = 2;
/** BM25's term-frequency saturation and length normalization for body text. */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const DEFAULT_SEARCH_LIMIT = 5;
/** A section that links to this many other pages is a hub: it names many features in passing. */
export const HUB_PAGE_COUNT = 5;
/** How much a hub section's score is multiplied, unless the query holds its heading as a phrase. */
const HUB_WEIGHT = 0.5;

/** The page that holds the released changelog sections, newest first (see `changelogSlice.ts`). */
export const CHANGELOG_PAGE = 'Changelog';

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

/** The number of other docs pages the section's prose links to. */
export function otherPagesLinked(section: Pick<DocSection, 'page' | 'markdown'>): number {
  const pages = new Set<string>();
  forEachProseLine(section.markdown, (source) => {
    for (const href of docsHrefs(source)) pages.add(hrefParts(href).page);
  });
  pages.delete('');
  pages.delete(section.page);
  return pages.size;
}

/** One section's search terms, by where they appear. */
interface SectionTerms {
  section: SplitSection;
  /** Terms of the section's heading and keyword lines, filler words included. */
  heading: Set<string>;
  /** The section's own heading as space-padded words, so a whole-phrase test is `includes`. */
  ownHeading: string;
  /** Whether the section is a hub; see {@link HUB_PAGE_COUNT}. */
  hub: boolean;
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
  /** Whether hub sections rank below specific ones. On unless `false`; the help probe sets it off for its control. */
  hubDemotion?: boolean;
}

/** Builds a Docs Index over the given pages. */
export function createDocsIndex({ pages, sidebar = '', fillerWords = true, hubDemotion = true }: DocsIndexInput): DocsIndex {
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
      ownHeading: section.level > 0 ? wordsOf(section.heading) : '',
      hub: hubDemotion && otherPagesLinked(section) >= HUB_PAGE_COUNT,
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
    search: (query, limit = DEFAULT_SEARCH_LIMIT, favor, { onSurface = false, floor = 0 } = {}) => {
      const ignored = onSurface && fillerWords ? new Set([...filler, ...SCREEN_WORDS]) : filler;
      const queryTerms = [...new Set(searchTerms(query, ignored))];
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
        // A hub ranks below a specific section of the same strength, unless the query holds its heading as a phrase.
        const asksHub = r.ownHeading.trim() !== '' && asked.includes(r.ownHeading);
        const weight = (r.section.page === favor?.page ? FAVORED_PAGE_WEIGHT : 1) * (r.hub && !asksHub ? HUB_WEIGHT : 1);
        return { section: r.section, score: score * (matched / terms.length) ** 2 * weight };
      });
      const hits = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
      const whatsNew = readWhatsNew(query);
      const lead = whatsNew ? releaseLead(whatsNew) : [];
      const ranked = [...hits.filter((s) => !isChangelog(s.section)), ...hits.filter((s) => isChangelog(s.section) && !lead.includes(s.section))];
      const least = (ranked[0]?.score ?? 0) * floor;
      const kept = ranked.filter((s, i) => i === 0 || s.score >= least).map((s) => s.section);
      return [...lead, ...kept].slice(0, limit).map(publicSection);
    },
    whatsNew: (query) => {
      const whatsNew = readWhatsNew(query);
      return whatsNew ? releaseLead(whatsNew).map(publicSection) : [];
    },
    get: (ids) => ids.flatMap((id) => {
      const section = byId.get(id);
      if (!section) return [];
      return (section.id === section.baseId ? all.filter((s) => s.baseId === id) : [section]).map(publicSection);
    }),
  };
}

function publicSection({ id, page, heading, label, trail, markdown, route, target }: SplitSection): DocSection {
  return {
    id, page, heading, label, trail, markdown,
    ...(route === undefined ? {} : { route }),
    ...(target === undefined ? {} : { target }),
  };
}
