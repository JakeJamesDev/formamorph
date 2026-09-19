// The SillyTavern user macro inside imported opening text. Import stores it in one canonical spelling and
// the draw renders it. The Persona Player Name chip adopts USER_MACRO and replaces the render here.

/** The one stored spelling of the user macro. */
export const USER_MACRO = '{{user}}';

const MARKER_RE = /\{\{\s*user\s*\}\}/gi;
// Opening punctuation a greeting puts before the marker: an asterisk action, quoted speech, emphasis.
const OPENERS = `["'“‘(\\[*_~«¿¡]*`;
// Start of text or line, or sentence punctuation (plus any closing quote or emphasis) and whitespace.
const SENTENCE_START_RE = new RegExp(`(?:^|\\n[ \\t]*|[.!?…]["'”’)\\]*_~»]*\\s+)${OPENERS}$`);

/** Write every spelling of the user macro as USER_MACRO. */
export function canonicalUserMacro(text: string): string {
  return text.replace(MARKER_RE, USER_MACRO);
}

/** Render the user macro as "you", or "You" where it starts a sentence. Verb agreement stays as written. */
export function renderUserMacro(text: string): string {
  return text.replace(MARKER_RE, (_match, offset: number) =>
    SENTENCE_START_RE.test(text.slice(0, offset)) ? 'You' : 'you');
}
