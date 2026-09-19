import { PROMPT_TEXT_KEYS, type PromptValues, type SectionStyle } from './promptPresets';
import { parsePromptTemplate, serializeSegments } from './promptTemplate';
import { variableForToken, variableAxes, decodeVariant, encodeVariant, baseToken, tokenVariant, splitToken, joinToken } from './promptVariables';

/**
 * Style downcasting. Prompts are authored canonically in markdown — `## Game World` headers and chip tokens
 * carrying the markdown `format` axis (e.g. `<STATS DESCRIPTION|descriptions.markdown>`). The labels style is
 * the plain counterpart: headers become `GAME WORLD:` and any chip's `format` axis drops to its default
 * (`|…markdown` → plain), so *markdown = `##` headers + markdown chip output; labels = `FOO:` headers + plain*.
 *
 * The header transform is line-anchored and only touches lines beginning with `#` — bullets, template colons
 * (`Scene:`, `Hunger: -10`), and prose are untouched by construction, so it's idempotent on already-labels
 * text. The reverse (labels → markdown) is intentionally unsupported: a flat `Foo:` line is ambiguous (real
 * header vs. output-format example), so markdown is always the single source of truth.
 *
 * The xml style instead wraps each section in `<tag>…</tag>` (heading slugified to the tag name); chip bodies
 * stay markdown for now. Like labels, it derives from the canonical markdown source, never the reverse.
 */

const HEADER_LINE = /^#{1,6}[ \t]+(.+?)[ \t]*$/gm;
const HEADER_TEST = /^(#{1,6})[ \t]+(.+?)[ \t]*$/;

/** Slugify a heading into an XML tag name: lowercase, non-alphanumerics collapsed to `_`, edges trimmed. */
function xmlTag(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Wrap each markdown section in `<tag>…</tag>`. Level-aware: a header of level N closes any open section of
 *  level ≥ N; all remaining tags close at EOF. Preamble before the first header stays outside any tag. */
function wrapXml(text: string): string {
  const out: string[] = [];
  const stack: { level: number; tag: string }[] = [];
  const closeTo = (level: number) => {
    while (stack.length && stack[stack.length - 1].level >= level) out.push(`</${stack.pop()!.tag}>`);
  };
  for (const line of text.split('\n')) {
    const m = HEADER_TEST.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    const level = m[1].length;
    const tag = xmlTag(m[2]);
    closeTo(level);
    out.push(`<${tag}>`);
    stack.push({ level, tag });
  }
  closeTo(0);
  return out.join('\n');
}

const toLabel = (text: string) => text.replace(HEADER_LINE, (_line, heading: string) => `${heading.toUpperCase()}:`);

/** Restyle the headings inside a placement's affixes. In xml, each one opens a tag that closes at the end of
 *  the placement, before the suffix's trailing whitespace, so the section vanishes with the value. */
function restyleAffixes(token: string, style: Exclude<SectionStyle, 'markdown'>): string {
  const parts = splitToken(token);
  if (!parts || (!parts.pre && !parts.post)) return token;
  if (style === 'labels') return joinToken({ ...parts, pre: toLabel(parts.pre), post: toLabel(parts.post) });
  const opened: string[] = [];
  const open = (text: string) => text.replace(HEADER_LINE, (_line, heading: string) => {
    opened.push(xmlTag(heading));
    return `<${xmlTag(heading)}>`;
  });
  const pre = open(parts.pre);
  const tail = /\s*$/.exec(parts.post)![0];
  const body = open(parts.post.slice(0, parts.post.length - tail.length));
  const closes = opened.reverse().map((tag) => `\n</${tag}>`).join('');
  return joinToken({ ...parts, pre, post: `${body}${closes}${tail}` });
}

// A token is masked while the line transforms run: an affix can span lines, and a heading inside one must
// not be read as a header line of the template itself.
const MASK = String.fromCharCode(0);
const MASKED = new RegExp(`${MASK}([0-9]+)${MASK}`, 'g');

/** Rewrite markdown section headers in `text` into `style` (markdown = identity), affixes included. */
export function restyle(text: string, style: SectionStyle): string {
  if (style === 'markdown') return text;
  const tokens: string[] = [];
  const masked = parsePromptTemplate(text)
    .map((seg) => (seg.type === 'text' ? seg.value : `${MASK}${tokens.push(restyleAffixes(seg.token, style)) - 1}${MASK}`))
    .join('');
  const out = style === 'xml' ? wrapXml(masked) : toLabel(masked);
  return out.replace(MASKED, (_m, i: string) => tokens[Number(i)]);
}

/** Set every format-bearing chip token's `format` axis to `format` (`null` = plain), leaving other axes
 *  untouched. Labels uses `null` (plain output); xml uses `'xml'` (nested-tag chip bodies). */
function setChipFormat(text: string, format: string | null): string {
  return serializeSegments(
    parsePromptTemplate(text).map((seg) => {
      if (seg.type !== 'variable') return seg;
      const variable = variableForToken(seg.token);
      if (!variable || !variableAxes(variable).some((a) => a.id === 'format')) return seg;
      const selection = { ...decodeVariant(variable, tokenVariant(seg.token)), format };
      // Rebuild through joinToken, carrying the placement's affixes: withVariant alone knows nothing
      // about them, so a style downcast would silently delete the user's connective wording.
      const parts = splitToken(seg.token);
      return {
        type: 'variable',
        token: joinToken({
          base: baseToken(seg.token),
          variantId: encodeVariant(variable, selection),
          pre: parts?.pre,
          post: parts?.post,
        }),
      };
    }),
  );
}

/** The styled value-set for a built-in preset: headers restyled, and the chip `format` axis aligned to the
 *  style — labels strips it to plain, xml sets it to nested-tag output, markdown keeps the authored value. */
export function buildStyledValues(canonical: PromptValues, style: SectionStyle): PromptValues {
  const out = {} as PromptValues;
  for (const key of PROMPT_TEXT_KEYS) {
    const headered = restyle(canonical[key], style);
    out[key] =
      style === 'labels' ? setChipFormat(headered, null) : style === 'xml' ? setChipFormat(headered, 'xml') : headered;
  }
  return out;
}
