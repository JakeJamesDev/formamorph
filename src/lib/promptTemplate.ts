import { TOKEN_PATTERN, splitToken } from './promptVariables';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { promptHeader, sectionSpacing } from './promptHeader';
import { tilePieces, type AnatomyPiece, type AnatomySource, type ContextLabel, type TiledRuns } from './requestAnatomy';

/** A prompt template parsed into an ordered run of literal text and variable tokens. */
export type PromptSegment =
  | { type: 'text'; value: string }
  | { type: 'variable'; token: string };

// Shared grammar: base, variant, literal affixes, then JSON-escaped Header.
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

/** Blank and sentinel values omit headed or affixed placements. */
function isBlankValue(value: string): boolean {
  return value.trim() === '' || value === NONE_PLACEHOLDER;
}

/** Resolve all placements, retaining tokens without a value; values use keys without Header or affixes. */
export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  return resolvePromptSegments(parsePromptTemplate(template), values).map(part => part.text).join('');
}

/** Resolve placements and their contextual section spacing for every rendering surface. */
export function resolvePromptSegments(segments: PromptSegment[], values: Record<string, string>) {
  const parts = segments.map(segment => {
    const resolved = segment.type === 'variable' ? resolveToken(segment.token, values) ?? values[segment.token] : undefined;
    return { segment, resolved: resolved !== undefined,
      text: segment.type === 'text' ? segment.value : resolved ?? segment.token };
  });
  const spacing = sectionSpacing(parts.map(part => ({ text: part.text,
    section: part.segment.type === 'variable' && part.resolved && !!splitToken(part.segment.token)?.header?.trim() })));
  return parts.map((part, i) => ({ ...part, text: spacing[i].before + part.text + spacing[i].after }));
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
  labels: TemplateLabels,
): TiledRuns {
  return tilePieces(promptTemplatePieces(template, values, labels));
}

/** How a template's two kinds of text are labeled. `source` is the editor the template lives in, carried by
 *  the author's prose and by its chips alike. A chip's run is identified by its own affix-free token;
 *  `tokens` adds a context label to the few whose value another prompt wrote. */
export interface TemplateLabels {
  source: AnatomySource;
  tokens?: Record<string, ContextLabel>;
}

/** The same split as {@link renderPromptTemplateRuns}, left as pieces so a caller can append its own
 *  (the narration's OOC rider, a mode directive) before tiling the message as a whole. */
export function promptTemplatePieces(
  template: string,
  values: Record<string, string>,
  labels: TemplateLabels,
): AnatomyPiece[] {
  return resolvePromptSegments(parsePromptTemplate(template), values).map(({ segment, text, resolved }) => {
    if (segment.type === 'text' || !resolved) return { text, source: labels.source };
    const key = splitToken(segment.token)?.key ?? segment.token;
    return {
      text,
      source: labels.source,
      chip: key,
      preserveWhenEmpty: true,
      ...(labels.tokens?.[key] ? { contextLabel: labels.tokens[key] } : {}),
    };
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
  const header = promptHeader(parts.header, parts.variantId?.split('.').find(id => id === 'markdown' || id === 'xml'));
  if (header) return isBlankValue(value) ? '' : `${header.pre}${parts.pre}${value}${parts.post}${header.post}`;
  if (!parts.pre && !parts.post) return value;
  return isBlankValue(value) ? '' : `${parts.pre}${value}${parts.post}`;
}
