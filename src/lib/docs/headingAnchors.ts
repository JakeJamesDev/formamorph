/**
 * The heading-to-anchor rule of the GitHub wiki, so a docs link written for the wiki resolves in the app
 * too. The wiki slugs a heading's rendered text: lowercase, drop every character that is not a letter,
 * mark, number, connector, space or hyphen, then turn each space into a hyphen. Emoji are dropped but
 * their variation selector (a mark) is kept. A repeated anchor on one page gains `-1`, `-2`, and so on.
 */

/** One heading of a docs page, in page order. */
export interface DocHeading {
  /** 1 for `#`, up to 6. */
  level: number;
  /** The heading's source text, inline markdown included. */
  text: string;
  /** The anchor the wiki gives it, unique on its page. */
  anchor: string;
  /** Zero-based line of the heading in the page source. */
  line: number;
}

const NOT_SLUG_CHAR = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;
/** A markdown link or image; group 1 is its text. */
export const MARKDOWN_LINK = /!?\[([^\]]*)\]\([^)]*\)/g;

/** The wiki anchor for one heading's source text, before the repeat suffix. */
export function headingAnchor(text: string): string {
  return text.replace(MARKDOWN_LINK, '$1').toLowerCase().replace(NOT_SLUG_CHAR, '').replace(/ /g, '-');
}

/** A section's hidden keyword line, `<!-- keywords: … -->`; group 1 is the list. */
export const KEYWORD_LINE = /^\s{0,3}<!--\s*keywords:(.*?)-->\s*$/i;

/** A section's hidden route line, `<!-- route: <surface id>[#<target>] -->`; group 1 is the text after the colon, trimmed. */
export const ROUTE_LINE = /^\s{0,3}<!--\s*route:\s*(.*?)\s*-->\s*$/i;

/** A route line's text split at its first `#`: the surface id, and the target when a `#` is there. */
export function routeParts(route: string): { surface: string; target?: string } {
  const hash = route.indexOf('#');
  return hash < 0 ? { surface: route } : { surface: route.slice(0, hash), target: route.slice(hash + 1) };
}

/** A heading's source text as a reader sees it. */
export function plainText(text: string): string {
  return text.replace(MARKDOWN_LINK, '$1').replace(/[*`]/g, '').trim();
}

/** Whether a heading's plain text names a task, as in "How to Make a Group". */
export function isHowToHeading(plain: string): boolean {
  return plain.startsWith('How to ');
}

/** A code fence line; group 1 is its marker. */
export const FENCE = /^\s{0,3}(```|~~~)/;
const ATX_HEADING = /^\s{0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;

/** Calls `visit` for each line of a page that is outside a code fence, with its zero-based line number. */
export function forEachProseLine(markdown: string, visit: (source: string, line: number) => void): void {
  let fence: string | null = null;
  markdown.split(/\r?\n/).forEach((source, line) => {
    const fenceMatch = FENCE.exec(source);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1];
      else if (fenceMatch[1] === fence) fence = null;
      return;
    }
    if (fence === null) visit(source, line);
  });
}

/** Every ATX heading of a page outside code fences, each with its unique wiki anchor. */
export function docHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const seen = new Map<string, number>();
  forEachProseLine(markdown, (source, line) => {
    const match = ATX_HEADING.exec(source);
    if (!match) return;
    const base = headingAnchor(match[2]);
    let anchor = base;
    while (seen.has(anchor)) {
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      anchor = `${base}-${count}`;
    }
    seen.set(anchor, 0);
    headings.push({ level: match[1].length, text: match[2], anchor, line });
  });
  return headings;
}
