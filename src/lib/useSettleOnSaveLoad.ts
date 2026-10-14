import { useEffect, useRef } from 'react';
import {
  codeBoundsToDeltas, settleTraits, statTraitsInForce, type GatedTraitResult, type TraitForceState, type TraitRuntimeState,
  type TraitWorld,
} from './traitRuntime';
import type { GameState, PlayerStat, Trait } from '@/types';

/** The save's history, which the load migrates with the live state. */
export interface SettleHistory {
  states: readonly GameState[];
  commit: (states: GameState[]) => void;
}

/** `stats` with an older save's code bounds turned into code deltas under the player's stat traits in
 *  force; the same array when none carried any. */
function statsWithCodeDeltas(stats: PlayerStat[], state: TraitForceState, world: TraitWorld): PlayerStat[] {
  const next = codeBoundsToDeltas(stats, statTraitsInForce(state, world));
  return next.every((stat, i) => stat === stats[i]) ? stats : next;
}

function snapshotWithCodeDeltas(snapshot: GameState, world: TraitWorld): GameState {
  const { globalStats, globalTraits, disabledTraitIds = [], ownedTraits, entityStats } = snapshot;
  const stats = statsWithCodeDeltas(globalStats, { traits: globalTraits, disabledTraitIds, ownedTraits, entityStats }, world);
  return stats === globalStats ? snapshot : { ...snapshot, globalStats: stats };
}

/**
 * Settle every owner's traits against the current world once per save load (Q34), after the loaded state
 * and its world have rendered. Code bounds an older save stored become code deltas first, in the live state
 * and in `history`. `loads` is the gameplay save-load count; loads before mount don't settle. The settle
 * waits while `ready` is false, so a library persona's owner is in the world first. A load that changes
 * nothing commits nothing.
 */
export function useSettleOnSaveLoad(
  loads: number,
  ready: boolean,
  state: TraitRuntimeState,
  world: () => TraitWorld,
  nameOf: (trait: Trait) => string,
  commit: (result: GatedTraitResult) => void,
  history?: SettleHistory,
): void {
  const settledLoads = useRef(loads);
  useEffect(() => {
    if (!ready || loads === settledLoads.current) return;
    settledLoads.current = loads;
    const at = world();
    const stats = statsWithCodeDeltas(state.stats, state, at);
    const result = settleTraits(stats === state.stats ? state : { ...state, stats }, at, nameOf);
    if (result.state !== state) commit(result);
    if (!history) return;
    const states = history.states.map((snapshot) => snapshotWithCodeDeltas(snapshot, at));
    if (states.some((snapshot, i) => snapshot !== history.states[i])) history.commit(states);
  }, [loads, ready, state, world, nameOf, commit, history]);
}
