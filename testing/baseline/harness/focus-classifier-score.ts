// Scoring for the Focus Classifier probe: the reply parser, the label metrics, and the arm comparison.

export const FOCUS_TIERS = ['Focus', 'Background', 'Offstage'] as const;
export type FocusTier = (typeof FOCUS_TIERS)[number];

const LETTER_LINE = /^[\s*_>#-]*\(?([A-Z]{1,2})\)?[*_]*\s*[:.)–—-]\s*[*_]*\s*([A-Za-z]+)/;

/**
 * The tier per letter in `reply`, or null when the reply fails the contract: a listed letter with no line,
 * a letter given two different tiers, or a tier word outside the three. Lines that name no listed letter
 * are ignored.
 */
export function parseFocusReply(reply: string, letters: readonly string[]): Record<string, FocusTier> | null {
  const wanted = new Set(letters);
  const tiers: Record<string, FocusTier> = {};
  for (const line of reply.split(/\r?\n/)) {
    const match = LETTER_LINE.exec(line);
    if (!match || !wanted.has(match[1])) continue;
    const word = match[2].toLowerCase();
    const tier = FOCUS_TIERS.find((t) => t.toLowerCase() === word);
    if (!tier) return null;
    const letter = match[1];
    if (tiers[letter] && tiers[letter] !== tier) return null;
    tiers[letter] = tier;
  }
  return letters.every((letter) => tiers[letter]) ? tiers : null;
}

/** One classified case: the expected and the predicted tier per entity name, or null for a parse failure. */
export interface LabelOutcome { expected: Record<string, FocusTier>; predicted: Record<string, FocusTier> | null }

export interface LabelTally {
  replies: number; parseFailures: number;
  focusExpected: number; focusFound: number;
  entities: number; tiersMatched: number;
}

/** Focus recall and tier match over every reply, counting a parse failure as a miss on every entity. */
export function tallyLabels(outcomes: readonly LabelOutcome[]): LabelTally {
  const tally: LabelTally = { replies: 0, parseFailures: 0, focusExpected: 0, focusFound: 0, entities: 0, tiersMatched: 0 };
  for (const { expected, predicted } of outcomes) {
    tally.replies++;
    if (!predicted) tally.parseFailures++;
    for (const [name, tier] of Object.entries(expected)) {
      tally.entities++;
      const got = predicted?.[name];
      if (got === tier) tally.tiersMatched++;
      if (tier === 'Focus') {
        tally.focusExpected++;
        if (got === 'Focus') tally.focusFound++;
      }
    }
  }
  return tally;
}

/** The mean of `values`, and the half-width of its 95% confidence interval. */
export function meanCi(values: readonly number[]): { mean: number; half: number } {
  const n = values.length;
  if (n === 0) return { mean: NaN, half: NaN };
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = n > 1 ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1) : 0;
  return { mean, half: 1.96 * Math.sqrt(variance / n) };
}

/**
 * Trimmed minus full on paired samples: the mean difference and its 95% interval. `noWorse` holds when the
 * interval's upper end reaches zero or above, so the data cannot rule out parity or a gain.
 */
export function pairedDiff(full: readonly number[], trimmed: readonly number[], higherIsBetter = true) {
  if (full.length !== trimmed.length) throw new Error('paired arms differ in length');
  const diffs = trimmed.map((t, i) => (higherIsBetter ? t - full[i] : full[i] - t));
  const { mean, half } = meanCi(diffs);
  return { mean, low: mean - half, high: mean + half, noWorse: mean + half >= 0 };
}
