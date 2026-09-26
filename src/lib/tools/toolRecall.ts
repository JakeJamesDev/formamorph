import { extractKeywords } from '@/lib/turnBanding';
import { cosineSimilarity, vectorKey } from '@/lib/memoryRelevance';
import { marginBar, REHYDRATE_SIM_THRESHOLD } from '@/lib/semanticRehydration';
import { DIARY_SIM_THRESHOLD } from '@/lib/semanticDiary';
import type { ToolMemory } from './toolSnapshot';

/** The most matches one recall returns. */
export const RECALL_LIMIT = 5;

/** One recall match, in the shape the AI reads. */
export type RecallMatch =
  | { turn: number; kind: 'digest'; text: string }
  | { turn: number; kind: 'diary'; character: string; text: string };

/** What a hybrid recall reads beside the words. */
export interface RecallMeaning {
  readonly queryVec: Float32Array;
  /** Cached vectors by `vectorKey`. */
  readonly vectors: ReadonlyMap<string, Float32Array>;
  /** Whether diary entries match by meaning: Diary Recall is on. */
  readonly diaries: boolean;
}

/** Each memory as one searchable record, oldest first, a turn's digest before its diary entries. */
const recallRecords = (memories: readonly ToolMemory[]): RecallMatch[] =>
  memories.flatMap(({ turn, digest, diaries }): RecallMatch[] => [
    ...(digest ? [{ turn, kind: 'digest' as const, text: digest }] : []),
    ...diaries.map(({ character, text }) => ({ turn, kind: 'diary' as const, character, text })),
  ]);

/** Rank groups for the limit: both ways, meaning only, words only. */
const BOTH = 0, MEANING = 1, WORDS = 2;

/**
 * The memories that best match `query`. Lexically, a record scores by how many of the query's words it
 * holds (lowercase, stop words removed). With `meaning`, a vectored record also matches when its cosine
 * clears its kind's floor and the Scene Recall median margin; records that match both ways rank first,
 * then meaning only by cosine, then words only. A tie goes to the newer turn. The survivors come back
 * oldest first.
 */
export function recallMatches(query: string, memories: readonly ToolMemory[], meaning: RecallMeaning | null = null): RecallMatch[] {
  const words = extractKeywords(query);
  const scored = recallRecords(memories).map((record, order) => {
    const held = new Set(extractKeywords(record.text));
    const vec = meaning && (record.kind === 'digest' || meaning.diaries) ? meaning.vectors.get(vectorKey(record.text)) : undefined;
    const sim = vec && meaning ? cosineSimilarity(meaning.queryVec, vec) : null;
    return { record, order, score: words.filter((w) => held.has(w)).length, sim };
  });
  const bar = marginBar(scored.flatMap(({ sim }) => (sim === null ? [] : [sim])));
  const floor = { digest: REHYDRATE_SIM_THRESHOLD, diary: DIARY_SIM_THRESHOLD };
  const ranked = scored.flatMap((s) => {
    const meant = s.sim !== null && s.sim >= Math.max(floor[s.record.kind], bar);
    if (!meant && !s.score) return [];
    return [{ ...s, group: meant ? (s.score ? BOTH : MEANING) : WORDS, sim: meant ? s.sim! : 0 }];
  });
  return ranked
    .sort((a, b) => a.group - b.group || b.sim - a.sim || b.score - a.score || b.record.turn - a.record.turn || a.order - b.order)
    .slice(0, RECALL_LIMIT)
    .sort((a, b) => a.order - b.order)
    .map(({ record }) => record);
}
