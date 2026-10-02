// The recall score of the help search probes, and the pure parts of the approaches `help-recall.cli.ts` compares.
import { HELP_SECTION_LIMIT } from '@/lib/formaquestion/helpSession';

/** The id of the whole section: part N of a split section counts as that section. */
export const baseSectionId = (id: string) => id.replace(/-part-\d+$/, '');

/** Whether one approach found a keyed section for one question. */
export interface RecallScore {
  /** A keyed section is the first section of the block. */
  first: boolean;
  /** A keyed section is among the sections one request holds at most, with no size budget. */
  at5: boolean;
  /** A keyed section is in the block that fits the request's size budget, so it reaches the model. */
  sent: boolean;
}

/** Scores the sections an approach ranks for a question (`block`) and the ones of them the request holds (`sentBlock`). */
export function scoreRecall(right: readonly string[], block: readonly string[], sentBlock: readonly string[]): RecallScore {
  const keyed = new Set(right.map(baseSectionId));
  const isRight = (id: string) => keyed.has(baseSectionId(id));
  return {
    first: block.length > 0 && isRight(block[0]),
    at5: block.slice(0, HELP_SECTION_LIMIT).some(isRight),
    sent: sentBlock.some(isRight),
  };
}

export interface RecallSummary {
  questions: number;
  first: number;
  at5: number;
  sent: number;
}

/** Each score as a share of the questions. */
export function summarizeRecall(scores: readonly RecallScore[]): RecallSummary {
  const share = (key: keyof RecallScore) => (scores.length ? scores.filter((s) => s[key]).length / scores.length : 0);
  return { questions: scores.length, first: share('first'), at5: share('at5'), sent: share('sent') };
}

/** The constant of reciprocal rank fusion; 60 is the value of the method's paper. */
const FUSION_K = 60;

/** Merges ranked id lists by reciprocal rank fusion: an id scores 1 / (k + rank) in each list that holds it. */
export function mergeRanks(lists: readonly (readonly string[])[]): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, at) => scores.set(id, (scores.get(id) ?? 0) + 1 / (FUSION_K + at + 1)));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Ids by the dot product of their vector with the query, best first. An id with several vectors scores by its best. */
export function rankByVector(query: Float32Array, entries: readonly { id: string; vector: Float32Array }[]): { id: string; score: number }[] {
  const best = new Map<string, number>();
  for (const { id, vector } of entries) {
    let dot = 0;
    for (let i = 0; i < query.length; i++) dot += query[i] * vector[i];
    if (dot > (best.get(id) ?? -Infinity)) best.set(id, dot);
  }
  return [...best.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

/** A line's letters and numbers as lowercase words, so a copy matches through markers, case and punctuation. */
const lineWords = (line: string) => (line.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');

/**
 * The list positions a model picked: each line of its reply that copies a line of the list, as an index
 * into `lines`. A reply line with no page matches when one line alone ends with it.
 */
export function readPicks(reply: string, lines: readonly string[]): number[] {
  const listed = lines.map(lineWords);
  const picks: number[] = [];
  for (const source of reply.split('\n')) {
    const words = lineWords(source.replace(/^\s*\d+[.)]\s*/, ''));
    if (!words) continue;
    let at = listed.indexOf(words);
    if (at < 0) {
      const ending = listed.flatMap((line, i) => (line.endsWith(` ${words}`) ? [i] : []));
      at = ending.length === 1 ? ending[0] : -1;
    }
    if (at >= 0 && !picks.includes(at)) picks.push(at);
    if (picks.length === HELP_SECTION_LIMIT) break;
  }
  return picks;
}

/** A section's text packed into chunks of whole blocks, each under `limit` characters where one block allows it. */
export function chunksOf(markdown: string, limit: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const block of markdown.split(/\n{2,}/)) {
    if (current && current.length + block.length + 2 > limit) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${block}` : block;
  }
  if (current) chunks.push(current);
  return chunks;
}
