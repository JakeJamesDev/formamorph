import { TOKEN_PATTERN, splitToken } from './promptVariables';
import { NONE_PLACEHOLDER } from './promptFallbacks';
import { promptHeader, sectionSpacing } from './promptHeader';
import { decodePlaceholderToken, parsePlaceholderText } from './placeholders';
import { tilePieces, type AnatomyPiece, type AnatomySource, type ContextLabel, type TiledRuns } from './requestAnatomy';

/** A prompt template parsed into an ordered run of literal text and variable tokens. */
export type PromptSegment =
  | { type: 'text'; value: string }
  | { type: 'variable'; token: string };

/** Headed chip sequences share one authored line break; headers supply rendered separation. */
export function compactChipSeparators(segments: PromptSegment[]): PromptSegment[] {
  return segments.map((segment, i) => segment.type === 'text'
    && /^[ \t\r\n]*\n[ \t\r\n]*$/.test(segment.value)
    && segments[i - 1]?.type === 'variable' && segments[i + 1]?.type === 'variable'
    && [segments[i - 1], segments[i + 1]].some(s => s.type === 'variable' && splitToken(s.token)?.header?.trim())
    ? { ...segment, value: segment.value.includes('\r\n') ? '\r\n' : '\n' } : segment);
}

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

/**
 * Which chips a template carries, as the affix-free tokens the value map is keyed by (`<NOTES>`,
 * `<DICTIONARY|before>`).
 *
 * Read through the parser rather than by substring: a placement with options
 * (`<NOTES|format=markdown|header="Player Notes">`) renders its value like any other, so a raw
 * `includes("<NOTES>")` calls the chip absent.
 */
export function templateChipKeys(template: string): Set<string> {
  return new Set(
    parsePromptTemplate(template).flatMap((s) =>
      s.type === 'variable' ? [splitToken(s.token)?.key ?? s.token] : [],
    ),
  );
}

/** Inverse of `parsePromptTemplate`: re-joins segments into the stored token-string. Round-trips
 *  exactly, so a prompt the user never touches stays byte-identical. */
export function serializeSegments(segments: PromptSegment[]): string {
  return segments.map((s) => (s.type === 'text' ? s.value : s.token)).join('');
}

/** A template split at both chip families: its own tokens, then the placeholder chips typed in the text
 *  between them. Round-trips like {@link parsePromptTemplate}. A render reads every template this way: a
 *  chip with no value renders as the text it is, so a template nobody keys reads unchanged. */
export function parseTemplateWithPlaceholders(template: string): PromptSegment[] {
  return parsePromptTemplate(template).flatMap((s) => (s.type === 'text' ? parsePlaceholderText(s.value) : [s]));
}

/** Blank and sentinel values omit headed or affixed placements. */
function isBlankValue(value: string): boolean {
  return value.trim() === '' || value === NONE_PLACEHOLDER;
}

/** Resolve all placements, retaining tokens without a value; values use keys without Header or affixes. */
export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  return resolvePromptSegments(parseTemplateWithPlaceholders(template), values).map(part => part.text).join('');
}

/** Resolve placements and their contextual section spacing for every rendering surface. */
export function resolvePromptSegments(segments: PromptSegment[], values: Record<string, string>) {
  const parts = compactChipSeparators(segments).map(segment => {
    const resolved = segment.type === 'variable' ? resolveToken(segment.token, values) ?? values[segment.token] : undefined;
    return { segment, resolved: resolved !== undefined,
      text: segment.type === 'text' ? segment.value : resolved ?? segment.token };
  });
  const sections = parts.map(part => part.segment.type === 'variable' && part.resolved && !!splitToken(part.segment.token)?.header?.trim());
  // Only template whitespace is collapsible; chip values and affixes remain intact.
  const chunks = parts.flatMap((part, owner) => {
    if (part.segment.type !== 'text') return [{ text: part.text, owner, gap: !part.text }];
    const [, leading, body, trailing] = /^([ \t\r\n]*)([\s\S]*?)([ \t\r\n]*)$/.exec(part.text)!;
    return [{ text: leading, owner, gap: true }, { text: body, owner, gap: !body }, { text: trailing, owner, gap: true }];
  });
  for (let start = 0; start < chunks.length;) {
    if (!chunks[start].gap) { start++; continue; }
    let end = start;
    while (end < chunks.length && chunks[end].gap) end++;
    const neighbors = chunks.slice(Math.max(0, start - 1), Math.min(chunks.length, end + 1));
    if (neighbors.some(chunk => sections[chunk.owner])) {
      const whitespace = chunks.slice(start, end).map(chunk => chunk.text).join('');
      let remaining = start === 0 || end === chunks.length ? ''
        : whitespace.replace(/(?:[ \t]*\r?\n){3,}/g, whitespace.includes('\r\n') ? '\r\n\r\n' : '\n\n');
      for (let i = start; i < end; i++) {
        const length = chunks[i].text.length;
        chunks[i].text = remaining.slice(0, length);
        remaining = remaining.slice(length);
      }
    }
    start = end;
  }
  for (const part of parts) part.text = '';
  for (const chunk of chunks) parts[chunk.owner].text += chunk.text;
  const spacing = sectionSpacing(parts.map((part, i) => ({ text: part.text, section: sections[i] })));
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
  return resolvePromptSegments(parseTemplateWithPlaceholders(template), values).map(({ segment, text, resolved }) => {
    if (segment.type === 'text' || !resolved) return { text, source: labels.source };
    // A placeholder's value is world data the playthrough picked, so no editor owns the run.
    if (decodePlaceholderToken(segment.token)) return { text, contextLabel: 'placeholder' };
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
  const header = promptHeader(parts.header, parts.headerFormat ?? parts.variantId?.split('.').find(id => id === 'markdown' || id === 'xml'));
  if (header) return isBlankValue(value) ? '' : `${header.pre}${parts.pre}${value}${parts.post}${header.post}`;
  if (!parts.pre && !parts.post) return value;
  return isBlankValue(value) ? '' : `${parts.pre}${value}${parts.post}`;
}
