/**
 * The period rule for a line beside a control: one sentence carries no period; two or more sentences end
 * with one. A sentence boundary is terminal punctuation followed by a space, which is also what a reader
 * takes for one. Returns the reason a line fails, or null.
 */
export function sentenceShapeViolation(text: string): string | null {
  const line = text.trim();
  const multi = /[.!?]['’”)]?\s/.test(line);
  if (multi && !/[.!?]$/.test(line)) return 'several sentences but no final period';
  if (!multi && /\.$/.test(line)) return 'one sentence with a period';
  return null;
}
