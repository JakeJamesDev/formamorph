// The SillyTavern user macro: the stored form of the Player Name chip. Import stores it as USER_MACRO, the one
// form other features match, and every placeholder pass renders it here.

/** The one stored spelling of the user macro. */
export const USER_MACRO = '{{user}}';

/** What the chip editor calls the marker. */
export const USER_MACRO_LABEL = 'Player Name';

/** Every spelling of the user macro as a pattern with no flags, so another token grammar can embed it. */
export const USER_MACRO_SOURCE = String.raw`\{\{\s*[Uu][Ss][Ee][Rr]\s*\}\}`;

/** Every spelling of the user macro: any case, inner spaces allowed. */
export const USER_MACRO_RE = new RegExp(USER_MACRO_SOURCE, 'g');

// No `g`, so a test carries no `lastIndex` into the next reader of the shared one.
const ANY_USER_MACRO_RE = new RegExp(USER_MACRO_SOURCE);
const WHOLE_USER_MACRO_RE = new RegExp(`^${USER_MACRO_SOURCE}$`);

const RENDER_RE = new RegExp(`${USER_MACRO_SOURCE}(['’]s\\b)?`, 'g');
// Opening punctuation a greeting puts before the marker: an asterisk action, quoted speech, emphasis.
const OPENERS = `["'“‘(\\[*_~«¿¡]*`;
// Start of text or line, or sentence punctuation (plus any closing quote or emphasis) and whitespace.
const SENTENCE_START_RE = new RegExp(`(?:^|\\n[ \\t]*|[.!?…]["'”’)\\]*_~»]*\\s+)${OPENERS}$`);

/**
 * The kind of text the marker sits in. An opening is page one or the player's first action, so with no
 * persona it speaks to the player; reference text (world, entity, dictionary) is read by the AI.
 */
export type UserMacroKind = 'opening' | 'reference';

export interface UserMacroRender {
  /** The persona's name. Absent or blank means no persona. */
  name?: string | null;
  kind?: UserMacroKind;
}

/** True when the text holds the marker in any spelling. */
export function hasUserMacro(text: string): boolean {
  return ANY_USER_MACRO_RE.test(text);
}

/** True when the token is the marker and nothing else, in any spelling. */
export function isUserMacroToken(token: string): boolean {
  return WHOLE_USER_MACRO_RE.test(token);
}

/** Write every spelling of the user macro as USER_MACRO. */
export function canonicalUserMacro(text: string): string {
  return text.replace(USER_MACRO_RE, USER_MACRO);
}

/**
 * Render the user macro. With a persona it becomes the name and a possessive keeps its written ending. With
 * none, opening text reads "you" and "your", and reference text reads "the player" and "the player's", each
 * capitalized where it starts a sentence. Verb agreement stays as written.
 */
export function renderUserMacro(text: string, { name, kind = 'opening' }: UserMacroRender = {}): string {
  const persona = name?.trim();
  return text.replace(RENDER_RE, (_match, possessive: string | undefined, offset: number) => {
    if (persona) return persona + (possessive ?? '');
    const word = kind === 'opening' ? (possessive ? 'your' : 'you') : `the player${possessive ?? ''}`;
    return SENTENCE_START_RE.test(text.slice(0, offset)) ? word[0].toUpperCase() + word.slice(1) : word;
  });
}
