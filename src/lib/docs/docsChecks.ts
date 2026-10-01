/** The docs coverage checks: one readable line per problem, over docs passed in as data. */
import { docHeadings, forEachProseLine } from './headingAnchors';

/** Docs pages by wiki page name (the file name without `.md`). */
export type DocsPages = Record<string, string>;

/** A docs page and one heading on it, by its wiki anchor. */
export interface DocTarget {
  page: string;
  anchor: string;
}

/** The wiki's start page, which holds the page index. */
export const HOME_PAGE = 'Home';
/** The wiki's navigation page, which holds the second page index. */
export const SIDEBAR_PAGE = '_Sidebar';

/** Pages in `docs/` that are not part of the player guide, so nothing in the app points at them. */
export const NON_GUIDE_PAGES: readonly string[] = [SIDEBAR_PAGE, 'Design-System', 'Writing-Guide'];

type AnchorIndex = Map<string, Set<string>>;

function anchorIndex(pages: DocsPages): AnchorIndex {
  return new Map(Object.entries(pages).map(([page, md]) => [page, new Set(docHeadings(md).map((h) => h.anchor))]));
}

function formatTarget(target: DocTarget): string {
  return `${target.page}#${target.anchor}`;
}

/** Why a page is not a guide page, or null when it is. */
function pageProblem(index: AnchorIndex, page: string): string | null {
  if (!index.has(page)) return `page ${page} does not exist`;
  if (NON_GUIDE_PAGES.includes(page)) return `page ${page} is not a guide page`;
  return null;
}

/** Why a target does not resolve to a guide heading, or null when it does. */
function targetProblem(index: AnchorIndex, target: DocTarget): string | null {
  const problem = pageProblem(index, target.page);
  if (problem) return problem;
  if (!index.get(target.page)?.has(target.anchor)) return `heading #${target.anchor} is not on ${target.page}`;
  return null;
}

export interface SurfaceCoverage {
  /** Every surface id the app has. */
  surfaceIds: readonly string[];
  map: Partial<Record<string, DocTarget>>;
  /** Surfaces players never see, with the reason. */
  exclusions: Partial<Record<string, string>>;
  pages: DocsPages;
}

/** Problems with the surface map: unmapped ids, dead targets, and list entries that are not surfaces. */
export function surfaceCoverageProblems(input: SurfaceCoverage): string[] {
  const index = anchorIndex(input.pages);
  const known = new Set(input.surfaceIds);
  const problems: string[] = [];
  for (const id of input.surfaceIds) {
    const target = input.map[id];
    const excluded = input.exclusions[id] !== undefined;
    if (excluded && target) problems.push(`${id} is excluded, so it needs no map entry`);
    if (target) {
      const problem = targetProblem(index, target);
      if (problem) problems.push(`${id} maps to ${formatTarget(target)}, but ${problem}`);
    } else if (!excluded) {
      problems.push(`${id} has no docs section: add it to the surface map`);
    }
  }
  for (const id of new Set([...Object.keys(input.map), ...Object.keys(input.exclusions)])) {
    if (!known.has(id)) problems.push(`${id} is listed but is not a surface id`);
  }
  return problems;
}

/** The fields of a help topic the check reads. */
export interface HelpTopicLink {
  wikiPage?: string;
  wikiAnchor?: string;
}

/** Problems with help-topic docs links: a topic with no heading, or a heading that does not resolve. */
export function helpTopicProblems(topics: Record<string, HelpTopicLink>, pages: DocsPages): string[] {
  const index = anchorIndex(pages);
  const problems: string[] = [];
  for (const [id, topic] of Object.entries(topics)) {
    if (!topic.wikiPage || !topic.wikiAnchor) {
      problems.push(`help topic ${id} links no docs heading: set wikiPage and wikiAnchor`);
      continue;
    }
    const target = { page: topic.wikiPage, anchor: topic.wikiAnchor };
    const problem = targetProblem(index, target);
    if (problem) problems.push(`help topic ${id} links ${formatTarget(target)}, but ${problem}`);
  }
  return problems;
}

const INLINE_CODE = /`[^`]*`/g;
const LINK = /(!?)\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The hrefs of one prose line's links to docs pages. */
function docsHrefs(source: string): string[] {
  const hrefs: string[] = [];
  for (const [, image, , href] of source.replace(INLINE_CODE, '').matchAll(LINK)) {
    // Images, outside sites and repo paths (`../src/…`) are not links between docs pages.
    if (!image && !SCHEME.test(href) && !href.startsWith('../') && !href.startsWith('/')) hrefs.push(href);
  }
  return hrefs;
}

/** An href's page, empty for a same-page link, and its decoded anchor, null when it names none. */
function hrefParts(href: string): { page: string; anchor: string | null } {
  const hash = href.indexOf('#');
  return hash < 0 ? { page: href, anchor: null } : { page: href.slice(0, hash), anchor: safeDecode(href.slice(hash + 1)) };
}

/** Problems with links between docs pages: a missing page, a missing heading, or a `.md` suffix. */
export function docsLinkProblems(pages: DocsPages): string[] {
  const index = anchorIndex(pages);
  const problems: string[] = [];
  for (const [page, markdown] of Object.entries(pages)) {
    forEachProseLine(markdown, (source, line) => {
      for (const href of docsHrefs(source)) {
        const where = `${page}:${line + 1} links ${href}`;
        const { page: pagePart, anchor } = hrefParts(href);
        if (pagePart.endsWith('.md')) {
          problems.push(`${where}: write ${pagePart.slice(0, -3)}, the wiki page name`);
          continue;
        }
        const targetPage = pagePart || page;
        const anchors = index.get(targetPage);
        if (!anchors) problems.push(`${where}, but page ${targetPage} does not exist`);
        else if (anchor !== null && !anchors.has(anchor)) problems.push(`${where}, but heading #${anchor} is not on ${targetPage}`);
      }
    });
  }
  return problems;
}

/** Guide pages that `indexPage` does not link. The home page and the index itself need no entry. */
export function indexProblems(pages: DocsPages, indexPage: string): string[] {
  const listed = new Set<string>();
  forEachProseLine(pages[indexPage] ?? '', (source) => {
    for (const href of docsHrefs(source)) listed.add(hrefParts(href).page);
  });
  return Object.keys(pages)
    .filter((page) => page !== HOME_PAGE && page !== indexPage && !NON_GUIDE_PAGES.includes(page) && !listed.has(page))
    .map((page) => `${indexPage} does not list ${page}`);
}

const GLOSSARY_PAGE = 'Glossary';
const TABLE_SEPARATOR = /^\|[\s:|-]+\|$/;

/** Glossary table rows whose term cell links no other guide page. */
export function glossaryProblems(pages: DocsPages): string[] {
  const glossary = pages[GLOSSARY_PAGE];
  if (glossary === undefined) return [`page ${GLOSSARY_PAGE} does not exist`];
  const index = anchorIndex(pages);
  const rows: { cell: string; line: number }[] = [];
  forEachProseLine(glossary, (source, line) => {
    const row = source.trim();
    if (!row.startsWith('|')) return;
    // A separator row follows the header row, which names no term.
    if (TABLE_SEPARATOR.test(row)) rows.pop();
    else rows.push({ cell: row.slice(1).split('|')[0].trim(), line });
  });
  return rows
    .filter(({ cell }) => !docsHrefs(cell).some((href) => {
      const { page } = hrefParts(href);
      return page !== '' && page !== GLOSSARY_PAGE && pageProblem(index, page) === null;
    }))
    .map(({ cell, line }) => `${GLOSSARY_PAGE}:${line + 1} term ${cell} links no guide page`);
}
