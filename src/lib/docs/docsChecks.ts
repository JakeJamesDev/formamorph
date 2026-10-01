/**
 * The docs coverage checks. Each returns one readable line per problem, so a test can assert on an empty
 * list and print what to fix. They take the docs as data (page name → markdown), so they run the same on
 * the real `docs/` folder and on a fixture.
 */
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

/** Why a target does not resolve to a guide heading, or null when it does. */
function targetProblem(index: AnchorIndex, target: DocTarget): string | null {
  const anchors = index.get(target.page);
  if (!anchors) return `page ${target.page} does not exist`;
  if (NON_GUIDE_PAGES.includes(target.page)) return `page ${target.page} is not a guide page`;
  if (!anchors.has(target.anchor)) return `heading #${target.anchor} is not on ${target.page}`;
  return null;
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
      const problem = targetProblem(index, target);
      if (problem) problems.push(`${id} maps to ${formatTarget(target)}, but ${problem}`);
      else if (gaps.has(id)) problems.push(`${id} maps to ${formatTarget(target)}, so remove it from the known gaps`);
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
    if (topic.wikiPage && topic.wikiAnchor) {
      const target = { page: topic.wikiPage, anchor: topic.wikiAnchor };
      const problem = targetProblem(index, target);
      if (problem) problems.push(`help topic ${id} links ${formatTarget(target)}, but ${problem}`);
      else if (gaps.has(id)) problems.push(`help topic ${id} links ${formatTarget(target)}, so remove it from the known gaps`);
    } else if (topic.wikiPage && !index.has(topic.wikiPage)) {
      problems.push(`help topic ${id} links page ${topic.wikiPage}, which does not exist`);
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
          problems.push(`${where}, but the wiki serves Page.md as raw text: write ${pagePart.slice(0, -3)}`);
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
