/** The grammar of a link between docs pages: how one is written in markdown, and what its href names. */

/** An inline code span on one line. */
export const INLINE_CODE = /`[^`]*`/g;
/** A markdown link or image on one line: group 1 is `!` for an image, group 2 its text, group 3 its href. */
export const INLINE_LINK = /(!?)\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** True for an href that names a docs page or heading. Outside sites and repo paths (`../src/…`) do not. */
export function isDocsHref(href: string): boolean {
  return !SCHEME.test(href) && !href.startsWith('../') && !href.startsWith('/');
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** The hrefs of one prose line's links to docs pages. */
export function docsHrefs(source: string): string[] {
  const hrefs: string[] = [];
  for (const [, image, , href] of source.replace(INLINE_CODE, '').matchAll(INLINE_LINK)) {
    // An image is not a link between docs pages.
    if (!image && isDocsHref(href)) hrefs.push(href);
  }
  return hrefs;
}

/** An href's page, empty for a same-page link, and its decoded anchor, null when it names none. */
export function hrefParts(href: string): { page: string; anchor: string | null } {
  const hash = href.indexOf('#');
  return hash < 0 ? { page: href, anchor: null } : { page: href.slice(0, hash), anchor: safeDecode(href.slice(hash + 1)) };
}

/** A docs page, and one heading on it by its wiki anchor when it names one. */
export interface DocTarget {
  page: string;
  anchor?: string;
}

/** The section id of a target, which is also its href: `page#anchor`, or the page alone. */
export function docTargetId(target: DocTarget): string {
  return target.anchor ? `${target.page}#${target.anchor}` : target.page;
}
