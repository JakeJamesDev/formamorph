import { extractKeywords } from '@/lib/turnBanding';
import { cosineSimilarity, vectorKey } from '@/lib/memoryRelevance';
import { marginBar, REHYDRATE_SIM_THRESHOLD } from '@/lib/semanticRehydration';
import { DIARY_SIM_THRESHOLD } from '@/lib/semanticDiary';
import type { ToolMeaning, ToolMemory } from './toolSnapshot';

/** The most matches one recall returns. */
export const RECALL_LIMIT = 5;

/** One recall match, in the shape the AI reads. */
export type RecallMatch =
  | { turn: number; kind: 'digest'; text: string }
  | { turn: number; kind: 'diary'; character: string; text: string };

/** What a hybrid recall reads beside the words: the snapshot's meaning match with the query embedded. */
export type RecallMeaning = Omit<ToolMeaning, 'embed'> & { readonly queryVec: Float32Array };

/** Each memory as one searchable record, oldest first, a turn's digest before its diary entries. */
const recallRecords = (memories: readonly ToolMemory[]): RecallMatch[] =>
  memories.flatMap(({ turn, digest, diaries }): RecallMatch[] => [
    ...(digest ? [{ turn, kind: 'digest' as const, text: digest }] : []),
    ...diaries.map(({ character, text }) => ({ turn, kind: 'diary' as const, character, text })),
  ]);

/** The order of the match groups for the limit. */
const RANK = { both: 0, meaning: 1, words: 2 } as const;

/**
 * The best matches for `query`, oldest first. Both-ways matches rank first, then meaning only by cosine,
 * then words only by word count; a tie goes to the newer turn.
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
  const ranked = scored.flatMap(({ sim, ...s }) => {
    const cosine = sim !== null && sim >= Math.max(floor[s.record.kind], bar) ? sim : 0;
    if (!cosine && !s.score) return [];
    return [{ ...s, cosine, rank: cosine ? (s.score ? RANK.both : RANK.meaning) : RANK.words }];
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || b.cosine - a.cosine || b.score - a.score || b.record.turn - a.record.turn || a.order - b.order)
    .slice(0, RECALL_LIMIT)
    .sort((a, b) => a.order - b.order)
    .map(({ record }) => record);
}
