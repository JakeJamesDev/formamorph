/**
 * The Strip Links And Images rule: markdown links and images leave narration history before a request. A
 * link keeps its text, an image goes. Pure text in, text out, so each request seam applies it the same way.
 */

// An inline destination: `(url)`, `(<url>)` or `(url "title")`, with one level of balanced parentheses.
const DESTINATION = String.raw`\(\s*(?:<[^>\n]*>|[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)`;
// Link text may hold one level of brackets, so a link around an image reads.
const LABEL = String.raw`((?:[^[\]]|\[[^\]]*\])*)`;

const INLINE_IMAGE = new RegExp(String.raw`[ \t]?!\[[^\]]*\]${DESTINATION}`, 'g');
const INLINE_LINK = new RegExp(String.raw`([ \t]?)\[${LABEL}\]${DESTINATION}`, 'g');
const DEFINITION = /^ {0,3}\[([^\]\n]+)\]:[ \t]*\S.*(?:\n|$)/gm;
const REFERENCE_IMAGE = /[ \t]?!\[[^\]]*\]\[([^\]\n]*)\]/g;
const REFERENCE_LINK = /([ \t]?)\[((?:[^[\]]|\[[^\]]*\])+)\]\[([^\]\n]*)\]/g;

const normalize = (label: string): string => label.trim().replace(/\s+/g, ' ').toLowerCase();

/** `text` with its markdown links turned into their text and its markdown images removed. */
export function stripLinksAndImages(text: string): string {
  if (!text.includes('](') && !text.includes('][') && !text.includes(']:')) return text;

  const defined = new Set<string>();
  let out = text.replace(DEFINITION, (_, label: string) => {
    defined.add(normalize(label));
    return '';
  });
  let removed = out.length !== text.length;

  // A reference counts only when a definition names it, so a bare "[1][2]" in prose survives.
  out = out
    .replace(REFERENCE_IMAGE, (whole, id: string) => {
      if (!defined.has(normalize(id))) return whole;
      removed = true;
      return '';
    })
    .replace(REFERENCE_LINK, (whole, lead: string, label: string, id: string) =>
      (defined.has(normalize(id || label)) ? `${lead}${label}` : whole));

  out = out.replace(INLINE_IMAGE, () => {
    removed = true;
    return '';
  });
  // A link left with no text (it held only an image) drops with its leading space, like an image.
  out = out.replace(INLINE_LINK, (_, lead: string, label: string) => {
    if (label) return `${lead}${label}`;
    removed = true;
    return '';
  });

  // A removal can strand blank lines or a trailing newline; text that lost nothing keeps its spacing.
  return removed ? out.replace(/\n{3,}/g, '\n\n').trim() : out;
}
