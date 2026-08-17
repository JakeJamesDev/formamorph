/** Common languages that small, local LLMs generally handle well — suggestions for the free-text language
 *  field. NOT an allow-list: any value is passed to the model verbatim, including a style directive
 *  (e.g. "formal English", "pirate speak"). The field just interpolates the string into the prompt. */
export const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
  'Russian', 'Polish', 'Ukrainian', 'Chinese', 'Japanese', 'Korean', 'Arabic',
  'Hindi', 'Turkish', 'Vietnamese', 'Indonesian',
];

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

/** The player-facing prompts that carry a language chip. The id is also the noun its directive names. */
export type LanguageSurface = 'narration' | 'choices';

/**
 * What one surface's `<LANGUAGE>` chip renders to — the imperative directive, or nothing at all when the
 * value counts as English.
 *
 * The single definition of the wording: the default templates deliver it through the chip like any other,
 * so there is no second copy in a builder that could drift from what an author's own placement sends.
 */
export const languageDirective = (surface: LanguageSurface, language: string): string =>
  isEnglishLanguage(language) ? '' : `Write all ${surface} in ${language.trim()}.`;
