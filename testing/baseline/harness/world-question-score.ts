/** Scores one world-question answer: grounded facts, leaks of what the save keeps hidden, and opinion phrasing (Q19). */

/** One fact, leak or solution an answer is read for. */
export interface Check {
  label: string;
  pattern: RegExp;
}

/** A "what would you try" case: the moves that solve the scene. Empty when the scene has no single solution. */
export interface Opinion {
  solutions: Check[];
}

export interface WorldAnswerScore {
  /** Each fact the answer misses. */
  missing: string[];
  /** The facts the answer names, of all the case's facts; 1 with none. */
  factShare: number;
  /** The answer names every fact. */
  correct: boolean;
  /** Each leak check the answer matches. */
  leaks: string[];
  /** On an opinion case: the answer phrases its suggestion as its own, and states no solution flat. */
  opinion?: { marked: boolean; flatSolutions: string[]; ok: boolean };
}

/** First-person and hedged forms that mark a suggestion as the speaker's own view. */
const OPINION_MARKER = /\b(I'?d|I would|I'?m (?:inclined|tempted)|I think|I'?d probably|if I were you|in your (?:shoes|place)|my (?:guess|instinct|hunch|suggestion|pick|bet)|personally|maybe|perhaps|might|could try|you could)\b/i;

/** The answer's sentences, with list items and line breaks as breaks too. */
const sentences = (answer: string) => answer.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** A solution stated flat: each solution check met in a sentence that carries no opinion marker. */
function flatSolutions(answer: string, solutions: readonly Check[]): string[] {
  const bare = sentences(answer).filter((sentence) => !OPINION_MARKER.test(sentence));
  return solutions.filter((solution) => bare.some((sentence) => solution.pattern.test(sentence))).map((solution) => solution.label);
}

export function scoreWorldAnswer(answer: string, { facts, leaks = [], opinion }: { facts: readonly Check[]; leaks?: readonly Check[]; opinion?: Opinion }): WorldAnswerScore {
  const missing = facts.filter((fact) => !fact.pattern.test(answer)).map((fact) => fact.label);
  const marked = OPINION_MARKER.test(answer);
  const flat = opinion ? flatSolutions(answer, opinion.solutions) : [];
  return {
    missing,
    factShare: facts.length ? (facts.length - missing.length) / facts.length : 1,
    correct: missing.length === 0,
    leaks: leaks.filter((leak) => leak.pattern.test(answer)).map((leak) => leak.label),
    ...(opinion && { opinion: { marked, flatSolutions: flat, ok: marked && flat.length === 0 } }),
  };
}

/** The shares over a set of answers. */
export interface WorldSummary {
  n: number;
  correct: number;
  factShare: number;
  leak: number;
  /** Of the opinion answers: those phrased as opinion. Null with none. */
  opinion: number | null;
}

const share = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

/** The shares over `scores`. Each of the `failed` requests counts as a wrong answer with no leak. */
export function summarizeWorldScores(scores: readonly WorldAnswerScore[], failed: number): WorldSummary {
  const n = scores.length + failed;
  const opinions = scores.filter((s) => s.opinion);
  return {
    n,
    correct: share(scores.filter((s) => s.correct).length, n),
    factShare: share(scores.reduce((sum, s) => sum + s.factShare, 0), n),
    leak: share(scores.filter((s) => s.leaks.length > 0).length, n),
    opinion: opinions.length ? share(opinions.filter((s) => s.opinion!.ok).length, opinions.length) : null,
  };
}
