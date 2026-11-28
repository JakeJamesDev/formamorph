/** Common languages that small, local LLMs generally handle well — suggestions for the free-text language
 *  field. NOT an allow-list: any value is passed to the model verbatim, including a style directive
 *  (e.g. "formal English", "pirate speak"). The field just interpolates the string into the prompt. */
export const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
  'Russian', 'Polish', 'Ukrainian', 'Chinese', 'Japanese', 'Korean', 'Arabic',
  'Hindi', 'Turkish', 'Vietnamese', 'Indonesian',
];

/** The ISO 639-1 code of each suggestion, keyed in lowercase. The server keeps a copy of these codes. */
const LANGUAGE_CODES = new Map([
  ['english', 'en'], ['spanish', 'es'], ['french', 'fr'], ['german', 'de'], ['italian', 'it'],
  ['portuguese', 'pt'], ['dutch', 'nl'], ['russian', 'ru'], ['polish', 'pl'], ['ukrainian', 'uk'],
  ['chinese', 'zh'], ['japanese', 'ja'], ['korean', 'ko'], ['arabic', 'ar'], ['hindi', 'hi'],
  ['turkish', 'tr'], ['vietnamese', 'vi'], ['indonesian', 'id'],
]);

/** The AI Language as the Daily Send reports it: a suggestion's code, or `other`. The typed text never passes through. */
export const aiLanguageCode = (language: string): string =>
  isEnglishLanguage(language) ? 'en' : LANGUAGE_CODES.get(language.trim().toLowerCase()) ?? 'other';

/** The Device Language of a browser language tag: language plus region without the script, or `unknown`. */
export const deviceLanguageCode = (tag: string): string => {
  try {
    const { language, region } = new Intl.Locale(tag);
    // `und` parses but has no language.
    if (!language) return 'unknown';
    return region ? `${language}-${region}` : language;
  } catch {
    return 'unknown';
  }
};

/**
 * Whether a language value means "just write English", and so fires no language directive at all.
 *
 * Blank and whitespace-only count, so clearing the field is a safe reset rather than a dangling label
 * in every prompt. Read-side only: whatever the player typed stays persisted as they left it.
 */
export const isEnglishLanguage = (language: string): boolean => {
  const value = language.trim().toLowerCase();
  return value === '' || value === 'english';
};

/** The player-facing prompts that carry a language directive. The id is also the noun its directive names. */
export type LanguageSurface = 'narration' | 'choices' | 'answers';

/**
 * The directive for one surface — the imperative line, or nothing at all when the value counts as English.
 * The narration and choices prompts send it through their `<LANGUAGE>` chip; the help prompt appends it.
 *
 * The single definition of the wording, so no prompt carries a second copy that could drift.
 */
export const languageDirective = (surface: LanguageSurface, language: string): string =>
  isEnglishLanguage(language) ? '' : `Write all ${surface} in ${language.trim()}.`;
