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
