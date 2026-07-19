import { PROMPT_TEXT_KEYS, type PromptValues, type SectionStyle } from './promptPresets';
import { parsePromptTemplate, serializeSegments } from './promptTemplate';
import { variableForToken, variableAxes, decodeVariant, encodeVariant, baseToken, tokenVariant, withVariant } from './promptVariables';

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

/** Rewrite markdown section headers in `text` into `style` (markdown = identity). */
export function restyle(text: string, style: SectionStyle): string {
  if (style === 'markdown') return text;
  if (style === 'xml') return wrapXml(text);
  return text.replace(HEADER_LINE, (_line, heading: string) => `${heading.toUpperCase()}:`);
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
      return { type: 'variable', token: withVariant(baseToken(seg.token), encodeVariant(variable, selection)) };
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
