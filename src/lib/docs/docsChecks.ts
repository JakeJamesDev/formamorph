/** The docs coverage checks: one readable line per problem, over docs passed in as data. */
import { docHeadings, forEachProseLine } from './headingAnchors';

/** Docs pages by wiki page name (the file name without `.md`). */
export type DocsPages = Record<string, string>;

/** A docs page and one heading on it, by its wiki anchor. */
export interface DocTarget {
  page: string;
  anchor: string;
}

/** Pages in `docs/` that are not part of the player guide, so nothing in the app points at them. */
export const NON_GUIDE_PAGES: readonly string[] = ['_Sidebar', 'Design-System', 'Writing-Guide'];

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

/** A dead target, or a live one whose owner is still a known gap. `owner` reads "X maps to". */
function mappingProblem(index: AnchorIndex, owner: string, target: DocTarget, isGap: boolean): string | null {
  const problem = targetProblem(index, target);
  if (problem) return `${owner} ${formatTarget(target)}, but ${problem}`;
  return isGap ? `${owner} ${formatTarget(target)}, so remove it from the known gaps` : null;
}

export interface SurfaceCoverage {
  /** Every surface id the app has. */
  surfaceIds: readonly string[];
  map: Partial<Record<string, DocTarget>>;
  /** Surfaces players never see, with the reason. */
  exclusions: Partial<Record<string, string>>;
  /** Surfaces that have no docs section yet. */
  knownGaps: readonly string[];
  pages: DocsPages;
}

/** Problems with the surface map: unmapped ids, dead targets, and list entries that must go. */
export function surfaceCoverageProblems(input: SurfaceCoverage): string[] {
  const index = anchorIndex(input.pages);
  const known = new Set(input.surfaceIds);
  const gaps = new Set(input.knownGaps);
  const problems: string[] = [];
  for (const id of input.surfaceIds) {
    const target = input.map[id];
    const excluded = input.exclusions[id] !== undefined;
    if (excluded && (target || gaps.has(id))) problems.push(`${id} is excluded, so it needs no map entry or known gap`);
    if (target) {
      const problem = mappingProblem(index, `${id} maps to`, target, gaps.has(id));
      if (problem) problems.push(problem);
    } else if (!excluded && !gaps.has(id)) {
      problems.push(`${id} has no docs section: add it to the surface map`);
    }
  }
  const listed = [...Object.keys(input.map), ...Object.keys(input.exclusions), ...input.knownGaps];
  for (const id of new Set(listed)) if (!known.has(id)) problems.push(`${id} is listed but is not a surface id`);
  return problems;
}

/** The fields of a help topic the check reads. */
export interface HelpTopicLink {
  wikiPage?: string;
  wikiAnchor?: string;
}

/** Problems with help-topic docs links: a missing or dead heading, and known gaps that must go. */
export function helpTopicProblems(
  topics: Record<string, HelpTopicLink>,
  knownGaps: readonly string[],
  pages: DocsPages,
): string[] {
  const index = anchorIndex(pages);
  const gaps = new Set(knownGaps);
  const problems: string[] = [];
  for (const [id, topic] of Object.entries(topics)) {
    const page = topic.wikiPage;
    if (page && topic.wikiAnchor) {
      const target = { page, anchor: topic.wikiAnchor };
      const problem = mappingProblem(index, `help topic ${id} links`, target, gaps.has(id));
      if (problem) problems.push(problem);
    } else if (page && pageProblem(index, page)) {
      problems.push(`help topic ${id} links ${page}, but ${pageProblem(index, page)}`);
    } else if (!gaps.has(id)) {
      problems.push(`help topic ${id} links no docs heading: set wikiPage and wikiAnchor`);
    }
  }
  for (const id of gaps) if (!(id in topics)) problems.push(`help topic ${id} is a known gap but is not a help topic`);
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

/** Problems with links between docs pages: a missing page, a missing heading, or a `.md` suffix. */
export function docsLinkProblems(pages: DocsPages): string[] {
  const index = anchorIndex(pages);
  const problems: string[] = [];
  for (const [page, markdown] of Object.entries(pages)) {
    forEachProseLine(markdown, (source, line) => {
      for (const match of source.replace(INLINE_CODE, '').matchAll(LINK)) {
        const [, image, , href] = match;
        // Images, outside sites and repo paths (`../src/…`) are not links between docs pages.
        if (image || SCHEME.test(href) || href.startsWith('../') || href.startsWith('/')) continue;
        const where = `${page}:${line + 1} links ${href}`;
        const hash = href.indexOf('#');
        const pagePart = hash < 0 ? href : href.slice(0, hash);
        const anchor = hash < 0 ? null : safeDecode(href.slice(hash + 1));
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
