import { TOKEN_PATTERN, splitToken } from './promptVariables';
import { NONE_PLACEHOLDER } from './promptFallbacks';

/** A prompt template parsed into an ordered run of literal text and variable tokens. */
export type PromptSegment =
  | { type: 'text'; value: string }
  | { type: 'variable'; token: string };

// The shared token grammar (see promptVariables.TOKEN_PATTERN): a known base, an optional known variant
// id, and optional quoted `pre=`/`post=` affixes, in that order.
const TOKEN_RE = new RegExp(TOKEN_PATTERN, 'g');

/** Split a template into text/variable segments. Only registry tokens become `variable` segments;
 *  any other `<...>` the user typed stays inside a `text` segment. */
export function parsePromptTemplate(template: string): PromptSegment[] {
  const segments: PromptSegment[] = [];
  let last = 0;
  for (const match of template.matchAll(TOKEN_RE)) {
    const idx = match.index;
    if (idx > last) segments.push({ type: 'text', value: template.slice(last, idx) });
    segments.push({ type: 'variable', token: match[0] });
    last = idx + match[0].length;
  }
  if (last < template.length) segments.push({ type: 'text', value: template.slice(last) });
  return segments;
}

/** Inverse of `parsePromptTemplate`: re-joins segments into the stored token-string. Round-trips
 *  exactly, so a prompt the user never touches stays byte-identical. */
export function serializeSegments(segments: PromptSegment[]): string {
  return segments.map((s) => (s.type === 'text' ? s.value : s.token)).join('');
}

/** A value that has nothing to say: blank, or the uniform `N/A` an empty context section renders. Only
 *  affixed placements consult this — `N/A` reads fine under a heading and absurd mid-sentence. */
function isBlankValue(value: string): boolean {
  return value.trim() === '' || value === NONE_PLACEHOLDER;
}

/**
 * Substitute every occurrence of each known token with its value (unlike `String.replace`, which only
 * swaps the first). A token with no entry in `values` is left untouched.
 *
 * Values are keyed by the AFFIX-FREE token, which is what `buildContextValues` precomputes — affixes are
 * unbounded, so the value map cannot enumerate them. A placement with no affixes therefore resolves
 * byte-identically to the pre-affix behavior; one with affixes wraps its value, or renders nothing at all
 * when there is no value to wrap (the whole point: "…, inside <empty>" must not reach the model).
 */
export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  return template.replace(TOKEN_RE, (match) => {
    const parts = splitToken(match);
    if (!parts) return match;
    const value = values[parts.key];
    if (value === undefined) return match;
    if (!parts.pre && !parts.post) return value;
    return isBlankValue(value) ? '' : `${parts.pre}${value}${parts.post}`;
  });
}
