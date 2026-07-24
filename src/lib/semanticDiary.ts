import { vectorKey, cosineSimilarity } from './memoryRelevance';

/**
 * Diary retrieval (semantic-memory roadmap step 4): instead of a character remembering only their
 * last N diary entries, keep a short recent tail for continuity and pull back the RELEVANT older
 * entries — "she remembers the last time you drew a blade." Pure selection over pre-embedded entry
 * texts; embedding production lives with the caller. Entries without a cached vector simply can't be
 * retrieved (per-entry fail-open); the recent tail never needs vectors at all.
 */

/** Newest entries always kept, vectors or not — the character's ongoing mood is continuity, not
 *  retrieval. With DIARY_RETRIEVE_MAX this totals the same 5 entries the pure-recency path fed, so
 *  turning retrieval on is token-neutral for the character pass. */
export const DIARY_RECENT_KEEP = 3;

/** Most older entries one action may pull back. */
export const DIARY_RETRIEVE_MAX = 2;

/** Minimum action-to-entry similarity to retrieve. Diary-shaped texts (short, first-person, oblique)
 *  separate WORSE than lore or digests under MiniLM: the probe's positives cluster 0.33-0.44 with
 *  false fires up to 0.33, so 0.34 is the measured knee (100% precision / 60% recall, cap 2) — but
 *  the margin is a hundredth, fragile across worlds. Deliberately conservative: retrieval that stays
 *  quiet beats a character reciting an unrelated memory. diary-retrieve-probe.mjs re-validates. */
export const DIARY_SIM_THRESHOLD = 0.34;

/** An older entry at or above this similarity to any already-included entry (recent tail or an
 *  earlier pick) is a near-duplicate and is skipped — a brooding character's five nearly identical
 *  "I still don't trust them" lines must not crowd out the one distinct memory. */
export const DIARY_DUP_THRESHOLD = 0.75;

/** Select the diary entries a character carries into their motivation pass: the newest
 *  DIARY_RECENT_KEEP verbatim, plus up to DIARY_RETRIEVE_MAX relevant older ones, merged back into
 *  chronological order (the diary block promises "oldest first"). `entries` must be chronological,
 *  as collectCharacterDiary returns them. */
export function selectRelevantDiary(
  entries: string[],
  queryVec: Float32Array,
  vectorsByKey: Map<string, Float32Array>,
): string[] {
  if (entries.length <= DIARY_RECENT_KEEP + DIARY_RETRIEVE_MAX) return entries;
  const recentStart = entries.length - DIARY_RECENT_KEEP;
  const recent = entries.slice(recentStart);
  const includedVecs = recent
    .map((e) => vectorsByKey.get(vectorKey(e)))
    .filter((v): v is Float32Array => !!v);

  const older = entries
    .slice(0, recentStart)
    .map((text, i) => ({ text, i, vec: vectorsByKey.get(vectorKey(text)) }))
    .filter((c): c is { text: string; i: number; vec: Float32Array } => !!c.vec)
    .map((c) => ({ ...c, sim: cosineSimilarity(queryVec, c.vec) }))
    .filter((c) => c.sim >= DIARY_SIM_THRESHOLD)
    .sort((a, b) => b.sim - a.sim);

  const picked: Array<{ text: string; i: number; vec: Float32Array }> = [];
  for (const c of older) {
    if (picked.length >= DIARY_RETRIEVE_MAX) break;
    const nearDup = [...includedVecs, ...picked.map((p) => p.vec)]
      .some((v) => cosineSimilarity(c.vec, v) >= DIARY_DUP_THRESHOLD);
    if (nearDup) continue;
    picked.push(c);
  }
  return [...picked.sort((a, b) => a.i - b.i).map((p) => p.text), ...recent];
}
