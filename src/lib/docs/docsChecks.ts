/** The docs coverage checks: one readable line per problem, over docs passed in as data. */
import { docHeadings, FENCE, forEachProseLine, isHowToHeading, KEYWORD_LINE, plainText, ROUTE_LINE, routeParts, type DocHeading } from './headingAnchors';
import { docsHrefs, docTargetId, hrefParts, type DocTarget } from './docsLinks';

/** Docs pages by wiki page name (the file name without `.md`). */
export type DocsPages = Record<string, string>;

/** The wiki page name of a docs file path: its file name without `.md`. */
export function pageNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1, -'.md'.length);
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

/** Why a page is not a guide page, or null when it is. */
function pageProblem(index: AnchorIndex, page: string): string | null {
  if (!index.has(page)) return `page ${page} does not exist`;
  if (NON_GUIDE_PAGES.includes(page)) return `page ${page} is not a guide page`;
  return null;
}

/** Why a target does not resolve to a guide heading, or null when it does. */
function targetProblem(index: AnchorIndex, target: Required<DocTarget>): string | null {
  const problem = pageProblem(index, target.page);
  if (problem) return problem;
  if (!index.get(target.page)?.has(target.anchor)) return `heading #${target.anchor} is not on ${target.page}`;
  return null;
}

export interface SurfaceCoverage {
  /** Every surface id the app has. */
  surfaceIds: readonly string[];
  map: Partial<Record<string, Required<DocTarget>>>;
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
      if (problem) problems.push(`${id} maps to ${docTargetId(target)}, but ${problem}`);
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
    if (problem) problems.push(`help topic ${id} links ${docTargetId(target)}, but ${problem}`);
  }
  return problems;
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

/**
 * Guide-page "How to…" headings whose next non-blank line is not a keyword line with words in it, and keyword
 * lines that are not the first line under a heading or hold an empty or repeated phrase.
 */
export function keywordLineProblems(pages: DocsPages): string[] {
  const problems: string[] = [];
  for (const [page, markdown] of Object.entries(pages)) {
    if (NON_GUIDE_PAGES.includes(page)) continue;
    const lines = markdown.split(/\r?\n/);
    const headings = docHeadings(markdown);
    const headingLines = new Set(headings.map((heading) => heading.line));
    forEachProseLine(markdown, (source, line) => {
      const list = KEYWORD_LINE.exec(source)?.[1];
      if (list === undefined) return;
      let above = line - 1;
      while (above >= 0 && lines[above].trim() === '') above--;
      if (!headingLines.has(above)) problems.push(`${page}:${line + 1} keyword line is not the first line under a heading`);
      const phrases = list.split(',').map((phrase) => phrase.trim().toLowerCase());
      if (phrases.includes('')) problems.push(`${page}:${line + 1} keyword line has an empty phrase`);
      const repeated = phrases.find((phrase, i) => phrase !== '' && phrases.indexOf(phrase) !== i);
      if (repeated !== undefined) problems.push(`${page}:${line + 1} keyword line repeats "${repeated}"`);
    });
    for (const heading of headings) {
      const text = plainText(heading.text);
      if (!isHowToHeading(text)) continue;
      const next = lines.slice(heading.line + 1).find((line) => line.trim() !== '') ?? '';
      const list = KEYWORD_LINE.exec(next)?.[1] ?? '';
      if (!/[\p{L}\p{N}]/u.test(list)) problems.push(`${page}:${heading.line + 1} heading ${text} has no keyword line under it`);
    }
  }
  return problems;
}

/** Code fences a page opens and never closes, each named by page and opening line. */
export function unclosedFenceProblems(pages: DocsPages): string[] {
  const problems: string[] = [];
  for (const [page, markdown] of Object.entries(pages)) {
    let open: { marker: string; line: number } | null = null;
    const lines = markdown.split(/\r?\n/);
    for (let line = 0; line < lines.length; line++) {
      const marker = FENCE.exec(lines[line])?.[1];
      if (marker === undefined) continue;
      if (open === null) open = { marker, line };
      else if (marker === open.marker) open = null;
    }
    if (open !== null) problems.push(`${page}:${open.line + 1} code fence is never closed`);
  }
  return problems;
}

/** The targets each surface registers; most surfaces register none. */
export type SurfaceTargets = Partial<Record<string, readonly string[]>>;

export interface RouteTargets {
  /** Every surface id the app has. */
  surfaceIds: readonly string[];
  /** Surfaces players never see, with the reason. */
  exclusions: Partial<Record<string, string>>;
  /** The targets each surface registers. */
  targets: SurfaceTargets;
}

/** Each guide-page route line outside code, with the heading it sits under. */
function forEachRouteLine(
  pages: DocsPages,
  visit: (route: { page: string; line: number; heading: DocHeading | undefined; value: string }) => void,
): void {
  for (const [page, markdown] of Object.entries(pages)) {
    if (NON_GUIDE_PAGES.includes(page)) continue;
    const headings = new Map(docHeadings(markdown).map((heading) => [heading.line, heading]));
    let heading: DocHeading | undefined;
    forEachProseLine(markdown, (source, line) => {
      heading = headings.get(line) ?? heading;
      const value = ROUTE_LINE.exec(source)?.[1];
      if (value !== undefined) visit({ page, line, heading, value });
    });
  }
}

/**
 * Route lines that name no surface, an unknown or excluded one, or a target the surface does not register, and
 * route lines that repeat in one section.
 */
export function routeLineProblems(pages: DocsPages, { surfaceIds, exclusions, targets }: RouteTargets): string[] {
  const problems: string[] = [];
  const known = new Set(surfaceIds);
  // A section is its page and heading line; -1 is the text above the page's first heading.
  const routed = new Set<string>();
  forEachRouteLine(pages, ({ page, line, heading, value }) => {
    const where = `${page}:${line + 1}`;
    const section = `${page}:${heading?.line ?? -1}`;
    if (routed.has(section)) problems.push(`${where} section has a second route line`);
    routed.add(section);
    const { surface: id, target } = routeParts(value);
    if (id === '') problems.push(`${where} route line names no surface`);
    else if (!known.has(id)) problems.push(`${where} route ${id} is not a surface id`);
    else if (exclusions[id] !== undefined) problems.push(`${where} route ${id} is on a ${exclusions[id]} surface that players never see`);
    else if (target !== undefined && !targets[id]?.includes(target)) {
      const name = heading ? plainText(heading.text) : page;
      const problem = target === '' ? 'the target is empty' : `${id} has no target ${target}`;
      problems.push(`${where} section ${name} routes to ${value}, but ${problem}`);
    }
  });
  return problems;
}

/**
 * Guide how-to sections whose route names a surface with registered targets but no target of its own: the
 * sections a target could sharpen. A report, never a failure.
 */
export function untargetedSections(pages: DocsPages, targets: SurfaceTargets): string[] {
  const sections: string[] = [];
  forEachRouteLine(pages, ({ page, heading, value }) => {
    const { surface, target } = routeParts(value);
    if (!heading || !isHowToHeading(plainText(heading.text)) || target !== undefined) return;
    if (targets[surface]?.length) sections.push(docTargetId({ page, anchor: heading.anchor }));
  });
  return sections;
}

export interface SurfaceRouteInput {
  /** The docs heading for each surface id. */
  map: Partial<Record<string, Required<DocTarget>>>;
  /** Surfaces players never see, with the reason. */
  exclusions: Partial<Record<string, string>>;
  /** The Docs Index over the pages: a section is what a player's answer carries, route included. */
  index: { get(ids: readonly string[]): { route?: string }[] };
}

/**
 * Surface-map sections the index holds whose route is missing, or names a surface other than the ones the map
 * ties to the section. A section tied to one surface carries that id. A target the index does not cut out as a
 * section, such as a `###` inside a `##`, is skipped, as are missing headings, which the coverage check reports.
 */
export function surfaceRouteProblems({ map, exclusions, index }: SurfaceRouteInput): string[] {
  const surfacesBySection = new Map<string, { target: Required<DocTarget>; ids: string[] }>();
  for (const [id, target] of Object.entries(map)) {
    if (!target || exclusions[id] !== undefined) continue;
    const section = surfacesBySection.get(docTargetId(target)) ?? { target, ids: [] };
    section.ids.push(id);
    surfacesBySection.set(docTargetId(target), section);
  }
  const problems: string[] = [];
  for (const [sectionId, { ids }] of surfacesBySection) {
    const section = index.get([sectionId])[0];
    if (!section) continue;
    const subject = `${sectionId} is the section of ${ids.join(', ')}`;
    if (section.route === undefined) problems.push(`${subject} but has no route line`);
    else if (!ids.includes(section.route)) problems.push(`${subject} but its route is ${section.route}`);
  }
  return problems;
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
