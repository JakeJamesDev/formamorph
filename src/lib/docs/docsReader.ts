/**
 * What the in-app reader needs from a docs section: where each docs link goes, the body without its
 * heading line, and a plain-text excerpt. Built on the Docs Index's three operations.
 */
import { docHeadings, FENCE, MARKDOWN_LINK } from './headingAnchors';
import { hrefParts, INLINE_CODE, INLINE_LINK, isDocsHref } from './docsLinks';
import type { DocSection, DocsIndex } from './docsIndex';

/** The section a docs href opens, read from the page that holds the link; null when it names none. */
export type DocsLinkResolver = (fromPage: string, href: string) => string | null;

/** The section with exactly this id. `get` on the id of a split section returns every part. */
export function sectionWithId(index: DocsIndex, id: string): DocSection | null {
  return index.get([id]).find((section) => section.id === id) ?? null;
}

/** Part 2 or later of a split section. It repeats the heading line of part 1. */
function isLaterPart(section: DocSection): boolean {
  const part = /-part-(\d+)$/.exec(section.id);
  return part !== null && section.label === `${section.heading} (Part ${part[1]})`;
}

/**
 * Resolves docs hrefs to section ids. A page link opens the page's first section. A heading link opens
 * the section that holds the heading, which is the heading's own section or the one above it.
 */
export function createDocsLinkResolver(index: DocsIndex): DocsLinkResolver {
  const pages = new Map(index.contents().map((entry) => [entry.page, entry.sections.map((s) => s.id)]));
  const anchorsByPage = new Map<string, Map<string, string>>();

  const anchorsOf = (page: string, sectionIds: string[]): Map<string, string> => {
    const cached = anchorsByPage.get(page);
    if (cached) return cached;
    // The page again, from its sections in order, with the section that owns each line.
    const lines: string[] = [];
    const owners: string[] = [];
    for (const id of sectionIds) {
      const section = sectionWithId(index, id);
      if (!section) continue;
      const own = section.markdown.split('\n').slice(isLaterPart(section) ? 1 : 0);
      lines.push(...own);
      owners.push(...own.map(() => id));
    }
    const anchors = new Map<string, string>();
    for (const heading of docHeadings(lines.join('\n'))) {
      if (!anchors.has(heading.anchor)) anchors.set(heading.anchor, owners[heading.line]);
    }
    anchorsByPage.set(page, anchors);
    return anchors;
  };

  return (fromPage, href) => {
    if (!isDocsHref(href)) return null;
    const { page: pagePart, anchor } = hrefParts(href);
    const page = pagePart || fromPage;
    const sectionIds = pages.get(page);
    if (!sectionIds) return null;
    if (!anchor) return sectionIds[0] ?? null;
    return anchorsOf(page, sectionIds).get(anchor) ?? null;
  };
}

/** The href prefix of a link that opens a section in the reader. A fragment, so link hardening keeps it. */
const READER_LINK = '#docs=';

/** The section id a reader link opens, or null for every other href. */
export function readerLinkTarget(href: string | undefined): string | null {
  if (!href?.startsWith(READER_LINK)) return null;
  try {
    return decodeURIComponent(href.slice(READER_LINK.length));
  } catch {
    return null;
  }
}

/** One prose line with each docs link that resolves turned into a reader link. Links in code stay. */
function withReaderLinksOnLine(line: string, page: string, resolve: DocsLinkResolver): string {
  const code = [...line.matchAll(INLINE_CODE)].map((m) => [m.index, m.index + m[0].length] as const);
  return line.replace(INLINE_LINK, (full: string, image: string, _text: string, href: string, offset: number) => {
    if (image || code.some(([from, to]) => offset >= from && offset < to)) return full;
    const target = resolve(page, href);
    if (target === null) return full;
    const at = full.lastIndexOf(href);
    // A parenthesis would end the markdown link early.
    const encoded = encodeURIComponent(target).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
    return `${full.slice(0, at)}${READER_LINK}${encoded}${full.slice(at + href.length)}`;
  });
}

/** A section's markdown with each link to a docs page turned into a reader link. */
export function withReaderLinks(markdown: string, page: string, resolve: DocsLinkResolver): string {
  let fence: string | null = null;
  return markdown.split('\n').map((line) => {
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1];
      else if (fenceMatch[1] === fence) fence = null;
      return line;
    }
    return fence === null ? withReaderLinksOnLine(line, page, resolve) : line;
  }).join('\n');
}

const HEADING_LINE = /^\s{0,3}#{1,6}[ \t]/;

/** A section's markdown without its own heading line, for a reader that draws the heading itself. */
export function sectionBody(section: DocSection): string {
  const lines = section.markdown.split('\n');
  return (HEADING_LINE.test(lines[0] ?? '') ? lines.slice(1) : lines).join('\n').trim();
}

const EXCERPT_CHARS = 240;

/** The start of a section's body as plain text, for a search result. */
export function sectionExcerpt(section: DocSection): string {
  const text = sectionBody(section)
    .replace(MARKDOWN_LINK, '$1')
    .replace(/^\s*(?:#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\|?[\s:|-]+\|\s*$/gm, '')
    .replace(/[*`]/g, '')
    .replace(/\||\[![A-Z]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS).trimEnd()}…` : text;
}
