import { ALL_PROMPT_VARIABLES, ALL_VARIANT_IDS } from './promptVariables';
import { escapeRegExp } from './utils';

/** A prompt template parsed into an ordered run of literal text and variable tokens. */
export type PromptSegment =
  | { type: 'text'; value: string }
  | { type: 'variable'; token: string };

// One alternation matching any known base token, with an optional `|variant` (e.g. `summary`, `list`)
// before the `>`. Bases are sorted longest-first so a shorter token can't mask a longer one.
const TOKEN_RE = new RegExp(
  '(?:' +
    ALL_PROMPT_VARIABLES.map((v) => v.token.slice(0, -1)) // drop trailing '>'
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|') +
    ')(?:\\|(?:' +
    ALL_VARIANT_IDS.map(escapeRegExp).join('|') +
    '))?>',
  'g',
);

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

/** Substitute every occurrence of each known token with its value (unlike `String.replace`, which
 *  only swaps the first). A token with no entry in `values` is left untouched. */
export function renderPromptTemplate(template: string, values: Record<string, string>): string {
  return template.replace(TOKEN_RE, (match) => values[match] ?? match);
}
