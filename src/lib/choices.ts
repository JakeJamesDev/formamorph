// Parse a raw choices response into the list shown to the player. Deliberately minimal so it never
// second-guesses a custom choice prompt's intent: it only strips a leading list marker a model tacks on
// (so a "- Fire..." line can't carry the dash into the chosen action) — no preamble/colon dropping,
// quote stripping, or de-duping, which could mangle legitimately-authored choices.

/** Leading ordered/unordered list markers to peel off the front of a choice line. */
const LEADING_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function parseChoices(raw: string, max = 6): string[] {
  return (raw || '')
    .split('\n')
    .map((line) => line.replace(LEADING_MARKER, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, max);
}
