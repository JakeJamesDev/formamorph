import type { BandTurn } from './turnBanding';
import { vectorKey, cosineSimilarity } from './memoryRelevance';

/**
 * Semantic rehydration selection: which old turns come back verbatim because the current action
 * returns to them. Selection is embedding-based (the turn's digest vector stands for the turn) with
 * the two guards that define this feature (docs-internal/semantic-memory-roadmap.md step 2):
 *   1. Near-duplicate penalty — a candidate too similar to an already-chosen turn OR to a recent
 *      floor turn is skipped. Raw similarity maximally favors the repeated charged turns that caused
 *      the charged-scene freeze; the penalty is what makes similarity safe to use here.
 *   2. Temporal framing is the caller's half: chosen turns ride as an explicit remembered-scene
 *      exchange (turnBanding), never as live-looking history.
 * Pure module; embedding production lives with the caller.
 */

/** Minimum action-to-turn similarity to rehydrate at all — below this the action isn't really
 *  returning to the scene, and a full verbatim turn is a lot of tokens to spend on a hunch. */
export const REHYDRATE_SIM_THRESHOLD = 0.35;

/** A candidate at or above this similarity to an already-chosen turn or a floor turn is a
 *  near-duplicate and is skipped (the freeze guard). */
export const REHYDRATE_DUP_THRESHOLD = 0.75;

/** Most turns one action may rehydrate, before the caller's token budget applies. */
export const REHYDRATE_MAX = 2;

/** Rank the band turns worth rehydrating for this action: candidates are digest-carrying band
 *  survivors (milestone selection has already run — a superseded scene can't come back), scored by
 *  plain cosine to the action, greedy best-first with the near-duplicate guard against both the
 *  already-chosen set and the floor turns' digests. Returns turnIds, best first, capped. Turns
 *  without a cached vector simply can't qualify (per-turn fail-open, like semantic lore). */
export function selectSemanticRehydrations(
  bandTurns: BandTurn[],
  floorTurns: BandTurn[],
  queryVec: Float32Array,
  vectorsByKey: Map<string, Float32Array>,
  maxCount = REHYDRATE_MAX,
): string[] {
  const vecOf = (t: BandTurn): Float32Array | undefined => {
    const d = t.summary?.trim();
    return d ? vectorsByKey.get(vectorKey(d)) : undefined;
  };
  const floorVecs = floorTurns.map(vecOf).filter((v): v is Float32Array => !!v);
  const scored = bandTurns
    .map((t) => ({ t, vec: vecOf(t) }))
    .filter((c): c is { t: BandTurn; vec: Float32Array } => !!c.vec && !!c.t.turnId)
    .map((c) => ({ ...c, sim: cosineSimilarity(queryVec, c.vec) }))
    .filter((c) => c.sim >= REHYDRATE_SIM_THRESHOLD)
    .sort((a, b) => b.sim - a.sim);

  const chosen: Array<{ id: string; vec: Float32Array }> = [];
  for (const c of scored) {
    if (chosen.length >= maxCount) break;
    const nearDup = [...chosen.map((x) => x.vec), ...floorVecs]
      .some((v) => cosineSimilarity(c.vec, v) >= REHYDRATE_DUP_THRESHOLD);
    if (nearDup) continue;
    chosen.push({ id: c.t.turnId!, vec: c.vec });
  }
  return chosen.map((c) => c.id);
}
