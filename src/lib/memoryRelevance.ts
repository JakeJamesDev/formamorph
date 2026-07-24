import type { BandTurn } from './turnBanding';
import { contentHash } from './contentHash';

/**
 * Pure scoring core of semantic memory: ranks digest-band memories by relevance to the current action
 * so budget trimming can drop the least relevant instead of the oldest. Kept free of worker/IndexedDB
 * imports so the math is unit-testable; embedding production lives in embeddingWorker/embeddingCache.
 */

/** The embedding model every cached vector must come from; part of each cache key so a model swap
 *  silently invalidates old vectors. */
export const EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

/** Turns of age at which a memory's relevance halves. Deliberately a constant: half-life tuning needs
 *  probe evidence, not a player knob. */
export const RELEVANCE_HALF_LIFE_TURNS = 40;

/** Cache key for one digest's vector under the current model. */
export function vectorKey(digestText: string): string {
  return `${EMBEDDING_MODEL_ID}:${contentHash(digestText)}`;
}

/** Dot product of two same-length vectors. Embeddings arrive L2-normalized from the worker, so this IS
 *  cosine similarity; mismatched lengths (a model swap that dodged the key check) score 0. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

/** Similarity discounted by age: halves every RELEVANCE_HALF_LIFE_TURNS so an old near-match can still
 *  outrank a recent non-match, but ties break toward recent. */
export function relevanceScore(cos: number, ageTurns: number): number {
  return cos * Math.pow(0.5, Math.max(0, ageTurns) / RELEVANCE_HALF_LIFE_TURNS);
}

/** Score every digest-carrying turn against the current-action vector, keyed by turnId. Age is the
 *  turn's distance (in digest-carrying turns) from the newest one. Returns null when any digest lacks
 *  a cached vector or a turnId — all-or-nothing, so every consuming stage either ranks the identical
 *  set or falls back to oldest-first together. */
export function buildRelevanceScores(
  turns: BandTurn[],
  queryVec: Float32Array,
  vectorsByKey: Map<string, Float32Array>,
): Map<string, number> | null {
  const withDigest = turns.filter((t) => t.summary && t.summary.trim());
  const scores = new Map<string, number>();
  for (let i = 0; i < withDigest.length; i++) {
    const t = withDigest[i];
    if (!t.turnId) return null;
    const vec = vectorsByKey.get(vectorKey(t.summary!.trim()));
    if (!vec) return null;
    const age = withDigest.length - 1 - i;
    scores.set(t.turnId, relevanceScore(cosineSimilarity(queryVec, vec), age));
  }
  return scores;
}
