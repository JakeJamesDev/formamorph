// A snapshot's global scope: the fields a save writes, and the shapes live gameplay state holds them in.
// Live state keeps the player's traits and stats in `playerTraits` / `playerStats` and the trait maps under
// the `world` owner key; a save splits every map into a global part and an owners part.

import type {
  CascadeOffTraitIds, CodePins, EntityStatValues, GameState, OwnedTraitStates, PlayerStat, SavedAppliedValues, SavedCascadeOff, Trait,
} from '@/types';
import { PLAYER_OWNER } from './traitGates';
import { recordKey, splitRecordKey } from './ownedTraitState';
import type { AppliedTraitValues } from './traitRuntime';

/** The trait and stat slice of a snapshot, in the shapes live state holds. */
export interface LiveSnapshot {
  playerStats: PlayerStat[];
  playerTraits: Trait[];
  disabledTraitIds?: string[];
  appliedTraitValues?: AppliedTraitValues;
  cascadeOffTraitIds?: CascadeOffTraitIds;
  ownedTraits?: OwnedTraitStates;
  entityStats?: EntityStatValues;
  codePins?: CodePins;
}

const hasKeys = (map: object | undefined): boolean => !!map && Object.keys(map).length > 0;

/** A live cascade-off map as a save holds it. Absent when nothing is cascaded off. */
export function savedCascadeOff(live: CascadeOffTraitIds | undefined): SavedCascadeOff | undefined {
  const { [PLAYER_OWNER]: global, ...owners } = live ?? {};
  const kept = Object.fromEntries(Object.entries(owners).filter(([, ids]) => ids.length));
  if (!global?.length && !hasKeys(kept)) return undefined;
  return { ...(global?.length ? { global } : {}), ...(hasKeys(kept) ? { owners: kept } : {}) };
}

/** A saved cascade-off map as live state holds it. */
export function liveCascadeOff(saved: SavedCascadeOff | undefined): CascadeOffTraitIds {
  return { ...(saved?.global?.length ? { [PLAYER_OWNER]: saved.global } : {}), ...saved?.owners };
}

/** Live trait stat records as a save holds them. Absent when there are none. */
export function savedAppliedValues(live: AppliedTraitValues | undefined): SavedAppliedValues | undefined {
  const global: NonNullable<SavedAppliedValues['global']> = {};
  const owners: NonNullable<SavedAppliedValues['owners']> = {};
  for (const [key, record] of Object.entries(live ?? {})) {
    const [owner, rest] = splitRecordKey(key);
    if (owner === null) global[rest] = record;
    else (owners[owner] ??= {})[rest] = record;
  }
  if (!hasKeys(global) && !hasKeys(owners)) return undefined;
  return { ...(hasKeys(global) ? { global } : {}), ...(hasKeys(owners) ? { owners } : {}) };
}

/** Saved trait stat records as live state holds them. */
export function liveAppliedValues(saved: SavedAppliedValues | undefined): AppliedTraitValues {
  const live: AppliedTraitValues = { ...saved?.global };
  for (const [owner, records] of Object.entries(saved?.owners ?? {})) {
    for (const [rest, record] of Object.entries(records)) live[recordKey(owner, rest)] = record;
  }
  return live;
}

/** A snapshot's trait and stat fields in the shapes live state holds them. */
export const liveSnapshotOf = (state: GameState): LiveSnapshot => ({
  playerStats: state.globalStats,
  playerTraits: state.globalTraits,
  disabledTraitIds: state.disabledTraitIds,
  appliedTraitValues: liveAppliedValues(state.appliedTraitValues),
  cascadeOffTraitIds: liveCascadeOff(state.cascadeOffTraitIds),
  ownedTraits: state.ownedTraits,
  entityStats: state.entityStats,
  codePins: state.codePins,
});

/** A snapshot as a save held it before global scope had its own fields. */
type PreGlobalSnapshot = Omit<GameState, 'globalStats' | 'globalTraits' | 'appliedTraitValues' | 'cascadeOffTraitIds'> & {
  playerStats?: PlayerStat[];
  playerTraits?: Trait[];
  appliedTraitValues?: AppliedTraitValues;
  cascadeOffTraitIds?: CascadeOffTraitIds;
};

/**
 * A snapshot written before global scope had its own fields, in the current shape: `playerStats` and
 * `playerTraits` become `globalStats` and `globalTraits`, and the cascade-off and applied-value maps split into
 * a global part and an owners part. Idempotent; a current snapshot returns as is.
 */
export function migrateGlobalFields(state: GameState): GameState {
  // A current snapshot has none of the old fields, so the cast only types the old ones.
  const old = state as unknown as PreGlobalSnapshot;
  if (!('playerStats' in old) && !('playerTraits' in old)) return state;
  const { playerStats, playerTraits, appliedTraitValues, cascadeOffTraitIds, ...rest } = old;
  const applied = savedAppliedValues(appliedTraitValues);
  const cascade = savedCascadeOff(cascadeOffTraitIds);
  // A field the old snapshot lacked stays absent, as it read before.
  return {
    ...rest,
    ...(playerStats ? { globalStats: playerStats } : {}),
    ...(playerTraits ? { globalTraits: playerTraits } : {}),
    ...(applied ? { appliedTraitValues: applied } : {}),
    ...(cascade ? { cascadeOffTraitIds: cascade } : {}),
  } as GameState;
}
