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

/** Margin a candidate must clear over the band's median action-similarity to fire (T2). Absolute
 *  cosine floors don't transfer across worlds — in a one-house same-cast world everything clears
 *  0.35, so the floor alone let one scene fire 10x during unrelated charged scenes. The median is
 *  the world's own baseline relatedness; a real return-to-scene stands out from it. Value from the
 *  recall-margin-probe sweep: 0.15 kept all return hits and cleaned 3/4 charged false-fires. */
export const REHYDRATE_MARGIN = 0.15;

/** Fewest scored candidates before the margin applies. A small band's median is mostly the
 *  candidate's own neighborhood — too noisy a baseline — so early game keeps the floor-only rule. */
export const REHYDRATE_MARGIN_MIN_BAND = 5;

/** Turns a scene sits out after riding: fired on turn X, it can't fire again before turn X + N.
 *  Kills same-scene stickiness (T1: 9/27 real-session firings were identical to the previous
 *  turn's; one scene rode three consecutive turns while the context froze). */
export const REHYDRATE_COOLDOWN_TURNS = 3;

/** Turn ids still cooling down at `currentTurn`, given each scene's last-fired turn. A gap of 0
 *  (same-turn re-roll) or negative (rolled-back save) does not block, so a re-roll reproduces the
 *  original selection instead of losing its recalled scene. */
export function rehydrationCooldownBlocked(
  lastFired: ReadonlyMap<string, number>,
  currentTurn: number,
  cooldown = REHYDRATE_COOLDOWN_TURNS,
): Set<string> {
  const blocked = new Set<string>();
  for (const [id, fired] of lastFired) {
    const gap = currentTurn - fired;
    if (gap > 0 && gap < cooldown) blocked.add(id);
  }
  return blocked;
}

/** Rank the band turns worth rehydrating for this action: candidates are digest-carrying band
 *  survivors (milestone selection has already run — a superseded scene can't come back), scored by
 *  plain cosine to the action, greedy best-first with the near-duplicate guard against both the
 *  already-chosen set and the floor turns' digests. Turns in `blocked` (the cooldown set) are
 *  excluded outright. A candidate must clear both the absolute floor and (once the band is big
 *  enough) the band's median similarity plus REHYDRATE_MARGIN — relevance relative to the world's
 *  own baseline, not just an absolute score. Returns turnIds, best first, capped. Turns without a
 *  cached vector simply can't qualify (per-turn fail-open, like semantic lore). */
export function selectSemanticRehydrations(
  bandTurns: BandTurn[],
  floorTurns: BandTurn[],
  queryVec: Float32Array,
  vectorsByKey: Map<string, Float32Array>,
  blocked: ReadonlySet<string> | null = null,
  maxCount = REHYDRATE_MAX,
): string[] {
  const vecOf = (t: BandTurn): Float32Array | undefined => {
    const d = t.summary?.trim();
    return d ? vectorsByKey.get(vectorKey(d)) : undefined;
  };
  const floorVecs = floorTurns.map(vecOf).filter((v): v is Float32Array => !!v);
  const candidates = bandTurns
    .map((t) => ({ t, vec: vecOf(t) }))
    .filter((c): c is { t: BandTurn; vec: Float32Array } => !!c.vec && !!c.t.turnId)
    .map((c) => ({ ...c, sim: cosineSimilarity(queryVec, c.vec) }));
  // The margin bar: median over ALL candidates (blocked ones still describe the band's baseline),
  // floor kept as the sanity bound. Below MIN_BAND the median is too noisy — floor-only.
  const sims = candidates.map((c) => c.sim).sort((a, b) => a - b);
  const median = sims.length % 2
    ? sims[(sims.length - 1) / 2]
    : (sims[sims.length / 2 - 1] + sims[sims.length / 2]) / 2;
  const minSim = candidates.length >= REHYDRATE_MARGIN_MIN_BAND
    ? Math.max(REHYDRATE_SIM_THRESHOLD, median + REHYDRATE_MARGIN)
    : REHYDRATE_SIM_THRESHOLD;
  const scored = candidates
    .filter((c) => !blocked?.has(c.t.turnId!))
    .filter((c) => c.sim >= minSim)
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
