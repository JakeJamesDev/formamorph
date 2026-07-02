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
 */

const HEADER_LINE = /^#{1,6}[ \t]+(.+?)[ \t]*$/gm;

/** Rewrite markdown section headers in `text` into `style` (markdown = identity). */
export function restyle(text: string, style: SectionStyle): string {
  if (style === 'markdown') return text;
  return text.replace(HEADER_LINE, (_line, heading: string) => `${heading.toUpperCase()}:`);
}

/** Drop every chip token's `format` axis to its default (plain), leaving other axes untouched. */
function stripChipFormat(text: string): string {
  return serializeSegments(
    parsePromptTemplate(text).map((seg) => {
      if (seg.type !== 'variable') return seg;
      const variable = variableForToken(seg.token);
      if (!variable || !variableAxes(variable).some((a) => a.id === 'format')) return seg;
      const selection = { ...decodeVariant(variable, tokenVariant(seg.token)), format: null };
      return { type: 'variable', token: withVariant(baseToken(seg.token), encodeVariant(variable, selection)) };
    }),
  );
}

/** The styled value-set for a built-in preset: headers restyled, and (for labels) chip formats stripped. */
export function buildStyledValues(canonical: PromptValues, style: SectionStyle): PromptValues {
  const out = {} as PromptValues;
  for (const key of PROMPT_TEXT_KEYS) {
    const headered = restyle(canonical[key], style);
    out[key] = style === 'labels' ? stripChipFormat(headered) : headered;
  }
  return out;
}
