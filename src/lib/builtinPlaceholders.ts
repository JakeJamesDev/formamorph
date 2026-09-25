import { placeholderAccent } from './highlightUtils';

/**
 * Built-in Placeholders: chips every world has, that no author creates, and that resolve from the playthrough
 * rather than from authored values. Each is one row here, and every chip surface reads the rows instead of
 * checking for a token by hand. Tokens keep the SillyTavern spelling, so pasted and imported ST text needs no
 * translation.
 */

/**
 * The kind of text a chip sits in. An opening is page one or the player's first action, so with no persona it
 * speaks to the player; reference text (world, entity, dictionary) is read by the AI.
 */
export type BuiltinTextKind = 'opening' | 'reference';

/** What the playthrough gives a Built-in to render with. */
export interface BuiltinRender {
  /** The persona's name. Absent or blank means no persona. */
  name?: string | null;
  kind?: BuiltinTextKind;
}

/** The field a chip would go into, for a row's visibility rule. */
export interface BuiltinField {
  /** The field offers Built-ins at all: prose fields do; name, keyword and prompt fields do not. */
  offered: boolean;
}

/** One match of a row's token, with the text a resolver reads around it. */
export interface BuiltinMatch {
  /** Everything before the token, as authored. */
  before: string;
  /** The row's suffix where the text carries it right after the token. */
  suffix?: string;
}

export interface BuiltinPlaceholder {
  id: string;
  label: string;
  /** The one stored spelling. */
  token: string;
  /** Every accepted spelling as a pattern with no flags, so another token grammar can embed it. */
  source: string;
  /** A pattern with no flags that the resolver takes along when it follows the token. */
  suffixSource?: string;
  /** What the typeahead matches besides the label. */
  searchTerms: readonly string[];
  accent: string;
  visible: (field: BuiltinField) => boolean;
  hint: string;
  resolve: (match: BuiltinMatch, render: BuiltinRender) => string;
}

// Opening punctuation a greeting puts before the marker: an asterisk action, quoted speech, emphasis.
const OPENERS = `["'“‘(\\[*_~«¿¡]*`;
// Start of text or line, or sentence punctuation (plus any closing quote or emphasis) and whitespace.
const SENTENCE_START_RE = new RegExp(`(?:^|\\n[ \\t]*|[.!?…]["'”’)\\]*_~»]*\\s+)${OPENERS}$`);

const USER_TOKEN = '{{user}}';

/**
 * With a persona it is the name, and a possessive keeps its written ending. With none, opening text reads
 * "you" and "your", and reference text reads "the player" and "the player's", each capitalized where it
 * starts a sentence. Verb agreement stays as written.
 */
export const PLAYER_NAME: BuiltinPlaceholder = {
  id: 'player-name',
  label: 'Player Name',
  token: USER_TOKEN,
  source: String.raw`\{\{\s*[Uu][Ss][Ee][Rr]\s*\}\}`,
  suffixSource: String.raw`['’]s\b`,
  searchTerms: ['user'],
  accent: placeholderAccent(USER_TOKEN),
  visible: ({ offered }) => offered,
  hint: 'Shows your persona’s name in play. With no persona, it reads “you” in an opening and “the player” elsewhere.',
  resolve: ({ before, suffix }, { name, kind = 'opening' }) => {
    const persona = name?.trim();
    if (persona) return persona + (suffix ?? '');
    const word = kind === 'opening' ? (suffix ? 'your' : 'you') : `the player${suffix ?? ''}`;
    return SENTENCE_START_RE.test(before) ? word[0].toUpperCase() + word.slice(1) : word;
  },
};

export const BUILTIN_PLACEHOLDERS: readonly BuiltinPlaceholder[] = [PLAYER_NAME];

/** Every Built-in token in any spelling, as a pattern with no flags. */
export const BUILTIN_TOKEN_SOURCE = BUILTIN_PLACEHOLDERS.map((row) => `(?:${row.source})`).join('|');

// No `g` on the tests, so none carries a `lastIndex` into the next reader.
const ANY_RE = new RegExp(BUILTIN_TOKEN_SOURCE);
const WHOLE = BUILTIN_PLACEHOLDERS.map((row) => ({ row, re: new RegExp(`^(?:${row.source})$`) }));
const ROW_RES = BUILTIN_PLACEHOLDERS.map((row) => ({ row, re: new RegExp(row.source, 'g') }));
// One alternative per row, its token and suffix named by row index, so a match says which row it was.
const RENDER_RE = new RegExp(
  BUILTIN_PLACEHOLDERS.map((row, i) => `(?<t${i}>${row.source})${row.suffixSource ? `(?<s${i}>${row.suffixSource})?` : ''}`)
    .join('|'),
  'g',
);

/** The row one whole token names, in any spelling. */
export function builtinForToken(token: string): BuiltinPlaceholder | undefined {
  return WHOLE.find(({ re }) => re.test(token))?.row;
}

/** The label a Built-in token reads as, or `undefined` for any other token. */
export function builtinLabel(token: string): string | undefined {
  return builtinForToken(token)?.label;
}

/** True when the text holds a Built-in in any spelling. */
export function hasBuiltin(text: string): boolean {
  return ANY_RE.test(text);
}

/** Write every spelling of every Built-in as its stored token. */
export function canonicalBuiltins(text: string): string {
  return ROW_RES.reduce((out, { row, re }) => out.replace(re, row.token), text);
}

/** A design-time surface has no playthrough, so each Built-in reads as its label. */
export function labelBuiltins(text: string): string {
  return ROW_RES.reduce((out, { row, re }) => out.replace(re, row.label), text);
}

/** Render every Built-in in the text from the playthrough. */
export function renderBuiltins(text: string, render: BuiltinRender = {}): string {
  return text.replace(RENDER_RE, (...args: unknown[]) => {
    // With named groups the replacer ends with offset, the whole string, then the groups.
    const groups = args[args.length - 1] as Record<string, string | undefined>;
    const offset = args[args.length - 3] as number;
    const at = BUILTIN_PLACEHOLDERS.findIndex((_row, i) => groups[`t${i}`] !== undefined);
    return BUILTIN_PLACEHOLDERS[at].resolve({ before: text.slice(0, offset), suffix: groups[`s${at}`] }, render);
  });
}
