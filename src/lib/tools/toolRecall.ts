import { extractKeywords } from '@/lib/turnBanding';
import type { ToolMemory } from './toolSnapshot';

/** The most matches one recall returns. */
export const RECALL_LIMIT = 5;

/** One recall match, in the shape the AI reads. */
export type RecallMatch =
  | { turn: number; kind: 'digest'; text: string }
  | { turn: number; kind: 'diary'; character: string; text: string };

/** Each memory as one searchable record, oldest first, a turn's digest before its diary entries. */
const recallRecords = (memories: readonly ToolMemory[]): RecallMatch[] =>
  memories.flatMap(({ turn, digest, diaries }): RecallMatch[] => [
    ...(digest ? [{ turn, kind: 'digest' as const, text: digest }] : []),
    ...diaries.map(({ character, text }) => ({ turn, kind: 'diary' as const, character, text })),
  ]);

/**
 * The memories that hold the most of `query`'s words: lowercase words with stop words removed, scored by
 * how many query words a record holds. A tie goes to the newer turn. The survivors come back oldest first.
 */
export function recallMatches(query: string, memories: readonly ToolMemory[]): RecallMatch[] {
  const words = extractKeywords(query);
  if (!words.length) return [];
  const scored = recallRecords(memories).flatMap((record, order) => {
    const held = new Set(extractKeywords(record.text));
    const score = words.filter((w) => held.has(w)).length;
    return score > 0 ? [{ record, order, score }] : [];
  });
  return scored
    .sort((a, b) => b.score - a.score || b.record.turn - a.record.turn || a.order - b.order)
    .slice(0, RECALL_LIMIT)
    .sort((a, b) => a.order - b.order)
    .map(({ record }) => record);
}
