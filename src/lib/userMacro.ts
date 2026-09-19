// The SillyTavern user macro inside imported opening text. Import stores it as USER_MACRO, the one form
// other features match, and the draw renders it here.

/** The one stored spelling of the user macro. */
export const USER_MACRO = '{{user}}';

/** Every spelling of the user macro: any case, inner spaces allowed. */
export const USER_MACRO_RE = /\{\{\s*user\s*\}\}/gi;

const RENDER_RE = new RegExp(`${USER_MACRO_RE.source}(['’]s\\b)?`, 'gi');
// Opening punctuation a greeting puts before the marker: an asterisk action, quoted speech, emphasis.
const OPENERS = `["'“‘(\\[*_~«¿¡]*`;
// Start of text or line, or sentence punctuation (plus any closing quote or emphasis) and whitespace.
const SENTENCE_START_RE = new RegExp(`(?:^|\\n[ \\t]*|[.!?…]["'”’)\\]*_~»]*\\s+)${OPENERS}$`);

/** Write every spelling of the user macro as USER_MACRO. */
export function canonicalUserMacro(text: string): string {
  return text.replace(USER_MACRO_RE, USER_MACRO);
}

/** Render the user macro as "you" and its possessive as "your", capitalized where it starts a sentence.
 *  Verb agreement stays as written. */
export function renderUserMacro(text: string): string {
  return text.replace(RENDER_RE, (_match, possessive: string | undefined, offset: number) => {
    const word = possessive ? 'your' : 'you';
    return SENTENCE_START_RE.test(text.slice(0, offset)) ? `Y${word.slice(1)}` : word;
  });
}
