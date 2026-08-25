import { TOKEN_PATTERN, splitToken } from './promptVariables';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { tilePieces, type AnatomyPiece, type AnatomySource, type ContextLabel, type TiledRuns } from './requestAnatomy';

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
  return template.replace(TOKEN_RE, (match) => resolveToken(match, values) ?? match);
}

/**
 * The same render as {@link renderPromptTemplate}, plus the run boundaries between what the author typed
 * and what a chip injected — the Request Anatomy sidecar's first source. `content` is byte-identical to
 * `renderPromptTemplate`'s output on the same inputs, which is what lets a labeled request be the request.
 *
 * A token with no value stays as the raw token, so it is counted as authored: an unresolved `<...>` is text
 * the author typed and the model reads verbatim.
 */
export function renderPromptTemplateRuns(
  template: string,
  values: Record<string, string>,
  labels: { source: AnatomySource; contextLabel: ContextLabel },
): TiledRuns {
  return tilePieces(promptTemplatePieces(template, values, labels));
}

/** The same split as {@link renderPromptTemplateRuns}, left as pieces so a caller can append its own
 *  (the narration's OOC rider, a mode directive) before tiling the message as a whole. */
export function promptTemplatePieces(
  template: string,
  values: Record<string, string>,
  labels: { source: AnatomySource; contextLabel: ContextLabel },
): AnatomyPiece[] {
  return parsePromptTemplate(template).map((segment) => {
    if (segment.type === 'text') return { text: segment.value, source: labels.source };
    const resolved = resolveToken(segment.token, values);
    return resolved === undefined
      ? { text: segment.token, source: labels.source }
      : { text: resolved, contextLabel: labels.contextLabel };
  });
}

/**
 * What one token renders to, or `undefined` when it has no value in the map (callers keep the raw token).
 * An empty string is a real result — an affixed placement whose value is absent renders as nothing — so
 * callers must use `??`, never `||`.
 *
 * Shared with the editor's preview panes so a preview shows exactly what the model receives, affixes and
 * all. Values are keyed by the affix-free token; a token from another chip family (placeholders) doesn't
 * parse here and returns undefined, leaving that family's own lookup to handle it.
 */
export function resolveToken(token: string, values: Record<string, string>): string | undefined {
  const parts = splitToken(token);
  if (!parts) return undefined;
  const value = values[parts.key];
  if (value === undefined) return undefined;
  if (!parts.pre && !parts.post) return value;
  return isBlankValue(value) ? '' : `${parts.pre}${value}${parts.post}`;
}
