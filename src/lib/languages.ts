/** Common languages that small, local LLMs generally handle well — suggestions for the free-text language
 *  field. NOT an allow-list: any value is passed to the model verbatim, including a style directive
 *  (e.g. "formal English", "pirate speak"). The field just interpolates the string into the prompt. */
export const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch',
  'Russian', 'Polish', 'Ukrainian', 'Chinese', 'Japanese', 'Korean', 'Arabic',
  'Hindi', 'Turkish', 'Vietnamese', 'Indonesian',
];
