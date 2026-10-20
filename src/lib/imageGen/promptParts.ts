// A prompt line split into `|` parts: a base, then one part per character.

/** Any `|`: NovelAI V4+ has no other use for it. */
export const ANY_PIPE = /\|/;

/** A `|` with whitespace on both sides, so A1111 `[a|b]` and wildcard `{a|b}` stay intact. */
const SPACED_PIPE = /(?<=\s)\|(?=\s)/;

/** The parts of `prompt` cut at `separator`, each without edge whitespace or commas; blanks kept. */
export const splitPromptParts = (prompt: string, separator: RegExp): string[] =>
  prompt.split(separator).map((part) => part.replace(/^[\s,]+|[\s,]+$/g, ''));

/** Parts joined as one line, in the spaced form every provider reads. */
export const joinPromptParts = (parts: string[]): string => parts.join(' | ');

/** A spaced-`|` line as one comma line, for a provider with no character prompts. */
export function flattenSpacedPipes(prompt: string): string {
  if (!SPACED_PIPE.test(prompt)) return prompt;
  return splitPromptParts(prompt, SPACED_PIPE).filter(Boolean).join(', ');
}
