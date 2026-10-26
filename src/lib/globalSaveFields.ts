// A snapshot's global scope: the fields a save writes, and the shapes live gameplay state holds them in.
// Live state keys trait stat records by `recordKey`; a save splits them into a global part and an owners part.

import type {
  CascadeOffTraitIds, CodePins, EntityStatValues, GameState, LoreToggles, OwnedTraitStates, PlayerStat, SavedAppliedValues, Trait,
} from '@/types';
import { recordKey, splitRecordKey } from './ownedTraitState';
import { compactCascadeOff, type AppliedTraitValues } from './traitRuntime';

/** The trait and stat slice of a snapshot, in the shapes live state holds. */
export interface LiveSnapshot {
  globalStats: PlayerStat[];
  globalTraits: Trait[];
  disabledTraitIds?: string[];
  appliedTraitValues?: AppliedTraitValues;
  cascadeOffTraitIds?: CascadeOffTraitIds;
  ownedTraits?: OwnedTraitStates;
  entityStats?: EntityStatValues;
  codePins?: CodePins;
  loreToggles?: LoreToggles;
}

const hasKeys = (map: object | undefined): boolean => !!map && Object.keys(map).length > 0;

/** A live cascade-off map as a save holds it. Absent when nothing is cascaded off. */
export function savedCascadeOff(live: CascadeOffTraitIds | undefined): CascadeOffTraitIds | undefined {
  const compact = compactCascadeOff(live);
  return hasKeys(compact) ? compact : undefined;
}

/** The owner key a save before global scope's own fields kept the global cascade-off list under. */
const LEGACY_GLOBAL_KEY = 'world';

/** A cascade-off map as a save before global scope's own fields held it, keyed by owner. */
function legacyCascadeOff(keyed: Readonly<Record<string, string[]>> | undefined): CascadeOffTraitIds | undefined {
  const { [LEGACY_GLOBAL_KEY]: global, ...owners } = keyed ?? {};
  return savedCascadeOff({ ...(global ? { global } : {}), owners });
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
  globalStats: state.globalStats,
  globalTraits: state.globalTraits,
  disabledTraitIds: state.disabledTraitIds,
  appliedTraitValues: liveAppliedValues(state.appliedTraitValues),
  cascadeOffTraitIds: state.cascadeOffTraitIds ?? {},
  ownedTraits: state.ownedTraits,
  entityStats: state.entityStats,
  codePins: state.codePins,
  loreToggles: state.loreToggles,
});

/** A snapshot as a save held it before global scope had its own fields. */
type PreGlobalSnapshot = Omit<GameState, 'globalStats' | 'globalTraits' | 'appliedTraitValues' | 'cascadeOffTraitIds'> & {
  playerStats?: PlayerStat[];
  playerTraits?: Trait[];
  appliedTraitValues?: AppliedTraitValues;
  cascadeOffTraitIds?: Record<string, string[]>;
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
  const cascade = legacyCascadeOff(cascadeOffTraitIds);
  // A field the old snapshot lacked stays absent, as it read before.
  return {
    ...rest,
    ...(playerStats ? { globalStats: playerStats } : {}),
    ...(playerTraits ? { globalTraits: playerTraits } : {}),
    ...(applied ? { appliedTraitValues: applied } : {}),
    ...(cascade ? { cascadeOffTraitIds: cascade } : {}),
  } as GameState;
}
