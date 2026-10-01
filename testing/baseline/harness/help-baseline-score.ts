// Scores a Formaquestion answer against a question's keys, by text match alone. No model judges an answer.

/** One keyed name, or a list of names of which one is enough. */
export type KeyedFact = string | string[];

export interface Keys {
  /** The section a correct answer comes from. Absent on a question the guide does not cover. */
  section?: string;
  /** The control names and terms a correct answer holds. */
  facts: KeyedFact[];
  /** The names a correct answer does not hold: the control of another task, or a name the app does not have. */
  forbidden: string[];
}

export interface HelpAnswer {
  /** The answer text, with the general-knowledge marker removed. */
  text: string;
  flagged: boolean;
  /** The ids of the docs sections that reached the model. */
  sources: string[];
}

export interface AnswerScore {
  /** The guide covers the question. */
  covered: boolean;
  /** The share of the keyed facts in the answer. */
  factShare: number;
  complete: boolean;
  /** The answer holds a forbidden name. */
  wrongStep: boolean;
  /** The bold names in the answer that the docs never use. */
  invented: number;
  flagged: boolean;
  /** The right section is among the sources. Null on a question the guide does not cover. */
  sourced: boolean | null;
  /** Every keyed fact and no forbidden name. */
  keysMet: boolean;
  /** Covered: the keys are met and the answer is not flagged. Not covered: the answer is flagged. */
  correct: boolean;
}

/** Text as the checks compare it: lower case, straight apostrophes, single spaces. */
const CURLY_APOSTROPHES = new RegExp('[\\u2018\\u2019]', 'g');
const plain = (text: string) => text.toLowerCase().replace(CURLY_APOSTROPHES, "'").replace(/\s+/g, ' ');

const REGEX_CHARS = /[.*+?^${}()|[\]\\]/g;

/** True when the text holds the name as a whole word. A Latin letter or digit beside it makes a longer word. */
export function hasName(text: string, name: string): boolean {
  const pattern = plain(name).trim().replace(REGEX_CHARS, '\\$&');
  return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`).test(text);
}

const boldNames = (text: string) => [...text.matchAll(/\*\*([^*\n]+)\*\*/g)].map((m) => m[1].trim().replace(/[:.,]$/, ''));
const baseId = (id: string) => id.replace(/-part-\d+$/, '');

/** Scores one answer. `docsText` is every docs section in one string, for the invented-name check. */
export function scoreAnswer(keys: Keys, answer: HelpAnswer, docsText: string): AnswerScore {
  const text = plain(answer.text);
  const found = keys.facts.filter((fact) => [fact].flat().some((name) => hasName(text, name))).length;
  const covered = keys.section !== undefined;
  const complete = keys.facts.length > 0 && found === keys.facts.length;
  const wrongStep = keys.forbidden.some((name) => hasName(text, name));
  const docs = plain(docsText);
  const keysMet = complete && !wrongStep;
  return {
    covered,
    factShare: keys.facts.length ? found / keys.facts.length : 0,
    complete,
    wrongStep,
    invented: boldNames(answer.text).map(plain).filter((name) => name.length > 1 && !docs.includes(name)).length,
    flagged: answer.flagged,
    sourced: covered ? answer.sources.some((id) => baseId(id) === keys.section) : null,
    keysMet,
    correct: covered ? keysMet && !answer.flagged : answer.flagged,
  };
}

const SPANISH = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'para', 'una', 'un', 'con', 'por', 'se', 'su', 'es', 'luego', 'pestaña', 'botón', 'selecciona', 'abre']);
const ENGLISH = new Set(['the', 'and', 'to', 'of', 'in', 'for', 'a', 'an', 'with', 'then', 'select', 'open', 'your', 'is', 'on']);

/** True when the prose of an answer is in the language. Bold control names stay in the guide's language, so they are left out. */
export function inLanguage(language: string, answer: string): boolean {
  const prose = answer.replace(/\*\*[^*\n]+\*\*/g, ' ');
  if (language === 'Japanese') {
    const letters = prose.match(/\p{L}/gu)?.length ?? 0;
    const japanese = prose.match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu)?.length ?? 0;
    return letters > 0 && japanese / letters > 0.5;
  }
  const words = prose.toLowerCase().match(/\p{L}+/gu) ?? [];
  const spanish = words.filter((word) => SPANISH.has(word)).length;
  const english = words.filter((word) => ENGLISH.has(word)).length;
  return language === 'Spanish' ? spanish > english : english > spanish;
}

/** One scored answer of a batch. */
export interface ScoredRow {
  caseId: string;
  kind: string;
  arm: string;
  run: number;
  score: AnswerScore;
  /** Tokens in and out, summed over the requests of the question. */
  promptTokens: number;
  answerTokens: number;
  /** A language question: the answer is in the AI Language. */
  inLanguage?: boolean;
}

/** The rates of a set of answers, each from 0 to 1. Null when the set has no answer the rate counts. */
export interface Summary {
  /** Answers to questions the guide covers. */
  covered: number;
  groundedCorrect: number | null;
  keysMet: number | null;
  wrongStep: number | null;
  /** Answers with a bold name the docs never use. */
  invented: number | null;
  /** A covered question flagged as not from the guide. */
  falseFlag: number | null;
  /** A covered question with an answer that is not correct and has no flag, so nothing warns the player. */
  wrongNoFlag: number | null;
  sourceAccuracy: number | null;
  /** Answers to questions the guide does not cover. */
  uncovered: number;
  /** An uncovered question with no flag. */
  missedFlag: number | null;
  inLanguage: number | null;
  promptTokens: number | null;
  answerTokens: number | null;
}

const rate = <T>(items: T[], pick: (item: T) => boolean) => (items.length ? items.filter(pick).length / items.length : null);
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round = (value: number | null) => (value === null ? null : Math.round(value));

export function summarize(rows: readonly ScoredRow[]): Summary {
  const covered = rows.filter((r) => r.score.covered).map((r) => r.score);
  const uncovered = rows.filter((r) => !r.score.covered).map((r) => r.score);
  const spoken = rows.filter((r) => r.inLanguage !== undefined);
  return {
    covered: covered.length,
    groundedCorrect: rate(covered, (s) => s.correct),
    keysMet: rate(covered, (s) => s.keysMet),
    wrongStep: rate(covered, (s) => s.wrongStep),
    invented: rate(covered, (s) => s.invented > 0),
    falseFlag: rate(covered, (s) => s.flagged),
    wrongNoFlag: rate(covered, (s) => !s.correct && !s.flagged),
    sourceAccuracy: rate(covered, (s) => s.sourced === true),
    uncovered: uncovered.length,
    missedFlag: rate(uncovered, (s) => !s.flagged),
    inLanguage: rate(spoken, (r) => r.inLanguage === true),
    promptTokens: round(mean(rows.map((r) => r.promptTokens))),
    answerTokens: round(mean(rows.map((r) => r.answerTokens))),
  };
}

export type Cause = 'search miss' | 'docs gap' | 'model error';

export interface WorstQuestion {
  caseId: string;
  runs: number;
  /** The share of the runs with a correct answer. */
  correct: number;
  factShare: number;
  sourced: number | null;
  flagged: number;
  wrongStep: number;
  /** A first sort only: read the answers before you name the cause. */
  likelyCause: Cause;
}

/**
 * The first cause the numbers point at. The right section did not reach the model: the search missed. It
 * did, and the model still said the guide does not cover the question: the section does not answer in the
 * player's words. Otherwise the model had the text and wrote a wrong answer.
 */
function likelyCause(scores: AnswerScore[]): Cause {
  const failed = scores.filter((s) => !s.correct);
  if (!scores[0].covered) return 'model error';
  if (failed.filter((s) => s.sourced === false).length * 2 > failed.length) return 'search miss';
  if (failed.filter((s) => s.flagged).length * 2 > failed.length) return 'docs gap';
  return 'model error';
}

/**
 * The questions with a failed run, worst first: fewest correct runs, then the most wrong steps, then the
 * fewest flags (a wrong answer with no flag misleads more), then the smallest share of keyed facts.
 */
export function worstQuestions(rows: readonly ScoredRow[], count: number): WorstQuestion[] {
  const byCase = new Map<string, AnswerScore[]>();
  for (const r of rows) byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r.score]);
  return [...byCase.entries()]
    .map(([caseId, scores]): WorstQuestion => ({
      caseId,
      runs: scores.length,
      correct: rate(scores, (s) => s.correct) ?? 0,
      factShare: mean(scores.map((s) => s.factShare)) ?? 0,
      sourced: scores[0].covered ? rate(scores, (s) => s.sourced === true) : null,
      flagged: rate(scores, (s) => s.flagged) ?? 0,
      wrongStep: rate(scores, (s) => s.wrongStep) ?? 0,
      likelyCause: likelyCause(scores),
    }))
    .filter((q) => q.correct < 1)
    .sort((a, b) => a.correct - b.correct || b.wrongStep - a.wrongStep || a.flagged - b.flagged || a.factShare - b.factShare || a.caseId.localeCompare(b.caseId))
    .slice(0, count);
}
