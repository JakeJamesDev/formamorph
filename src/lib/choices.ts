// Parse a raw choices response into the list shown to the player. Deliberately minimal so it never
// second-guesses a custom choice prompt's intent: it only strips a leading list marker a model tacks on
// (so a "- Fire..." line can't carry the dash into the chosen action) — no preamble/colon dropping,
// quote stripping, or de-duping, which could mangle legitimately-authored choices.

/** Leading ordered/unordered list markers to peel off the front of a choice line. */
const LEADING_MARKER = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** Split a raw choices response into one action per non-blank line, stripping only a leading list marker,
 *  capped at `max`. Intentionally minimal so a custom prompt's authored choices survive intact. */
export function parseChoices(raw: string, max = 6): string[] {
  return (raw || '')
    .split('\n')
    .map((line) => line.replace(LEADING_MARKER, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, max);
}

// "Glue" words carry no signal for which choice an action grew from; dropping them lets the shared
// content words drive the score, so light rewording ("knock on the wall" → "I knock on the wall firmly")
// still matches.
const CHOICE_GLUE = new Set([
  'the', 'a', 'an', 'to', 'of', 'and', 'or', 'you', 'your', 'i', 'my', 'me', 'is', 'it', 'on', 'in',
  'at', 'with', 'for', 'try', 'can',
]);

/** Content-word set of a phrase: lowercased, markdown `**` + punctuation stripped, glue words dropped. */
function choiceWordSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/\*\*/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0 && !CHOICE_GLUE.has(w)),
  );
}

/** Sørensen–Dice similarity of two word sets: `2·|shared| / (|a|+|b|)`, in [0,1]. */
function diceSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/** Best-matching choice index for one action phrase, or `-1` when nothing clears `threshold`. */
function bestChoiceFor(phrase: string, choices: readonly string[], threshold: number): number {
  const a = choiceWordSet(phrase);
  let bestIdx = -1;
  let bestScore = 0;
  choices.forEach((choice, i) => {
    const score = diceSimilarity(a, choiceWordSet(choice));
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  return bestScore >= threshold ? bestIdx : -1;
}

/**
 * Infer which listed choice(s) the player acted on, by fuzzy-matching their `action` against `choices`.
 * An action can stack several choices (shift+click joins them into one sentence each), so the action is split
 * on sentence boundaries and each segment resolves to its own best choice — matching the whole action at once
 * would dilute a two-choice pick below threshold. Returns the matched indices ascending, `[]` for a custom
 * action. Pure inference from the text — the chosen options are never stored, only recovered — so lightly
 * reworded choices still resolve. Uses word-set Dice similarity (tolerant of added/dropped/reordered words).
 */
export function matchChoicesToAction(action: string, choices: readonly string[], threshold = 0.5): number[] {
  if (!action || choices.length === 0) return [];
  const segments = action.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const matched = new Set<number>();
  for (const segment of segments.length > 0 ? segments : [action]) {
    const idx = bestChoiceFor(segment, choices, threshold);
    if (idx >= 0) matched.add(idx);
  }
  return [...matched].sort((x, y) => x - y);
}
