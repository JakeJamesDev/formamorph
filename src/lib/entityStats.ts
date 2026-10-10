// Entity stats in play: each authored entity's stat values, seeded at a new game and backfilled on load, and
// the owners whose regen and code run each turn.

import type { Entity, EntityStatValues, PersonaRef, PlayerStat, Trait } from '@/types';
import { inCast, playsAs } from './bearers';
import { backfillPlayerStats } from './statBackfill';
import { activeStatEnabled } from './traitEffects';
import { seedNewGameStats } from './traitRuntime';
import { regenOwners, statsOf, type OwnerStats, type StatOwner } from './statOwners';
import { overlayStatCodeResult, type OwnerCodeResult, type OwnerCodeTurn } from './statCodeTurn';

type StatEntity = Pick<Entity, 'id' | 'stats'>;

/** The traits that move an entity's stats: none, since an entity's own traits move no stats. */
const ENTITY_STAT_TRAITS: readonly Trait[] = [];

/** Each authored entity that owns stats, every stat seeded as a new game seeds the player's. */
export const seedEntityStats = (entities: readonly StatEntity[]): EntityStatValues =>
  Object.fromEntries(entities.filter((e) => e.stats?.length).map((e) => [e.id, seedNewGameStats(e.stats ?? [])]));

/** `saved` with each authored stat it lacks added at its starting value, owner by owner, as the player's stats
 *  are backfilled. A stat the world removed stays. The same map when nothing is missing. */
export function backfillEntityStats(saved: EntityStatValues | undefined, entities: readonly StatEntity[]): EntityStatValues {
  const base = saved ?? {};
  let out: EntityStatValues | null = null;
  for (const entity of entities) {
    if (!entity.stats?.length) continue;
    const held = base[entity.id] ?? [];
    const next = backfillPlayerStats(held, entity.stats);
    if (next !== held || !(entity.id in base)) (out ??= { ...base })[entity.id] = next;
  }
  return out ?? base;
}

/** `values` after one regen tick over `hours` for each of `owners`; the same map when none runs. */
export function withEntityRegen(values: EntityStatValues, owners: readonly StatOwner[], hours: number): EntityStatValues {
  if (!owners.length) return values;
  const tick = regenOwners(owners, hours);
  return { ...values, ...Object.fromEntries(owners.map((owner) => [owner.id, [...statsOf(tick.stats, owner.id)]])) };
}

/** Each owner's part of a code run. `hours` null is the before box, which takes no regen. `prepare` readies an
 *  owner's stats for the sandbox, after the tick. */
export function entityCodeTurns(
  owners: readonly StatOwner[], hours: number | null, prepare: (ownerId: string, stats: PlayerStat[]) => PlayerStat[],
): OwnerCodeTurn[] {
  const tick = hours === null ? null : regenOwners(owners, hours);
  return owners.map((owner) => ({
    id: owner.id,
    stats: prepare(owner.id, tick ? [...statsOf(tick.stats, owner.id)] : [...owner.stats]),
    enabled: owner.enabled,
    previous: owner.stats,
    regenApplied: tick?.applied[owner.id] ?? {},
  }));
}

/** Each owner's code result laid onto the latest `values`, which may have moved since the run read its
 *  snapshot. The same map when no owner moved. */
export function withOwnerCodeResults(
  values: EntityStatValues, results: Readonly<Record<string, OwnerCodeResult>> | undefined,
): EntityStatValues {
  const moved = Object.entries(results ?? {}).filter(([id, r]) => values[id] && (r.moved.length || r.boundsChanged.length));
  if (!moved.length) return values;
  return {
    ...values, ...Object.fromEntries(moved.map(([id, r]) => [id, overlayStatCodeResult(values[id], r, ENTITY_STAT_TRAITS)])),
  };
}

/** {@link backfillEntityStats} on a saved state; the same state when nothing is missing. */
export function backfillGameStateEntityStats<S extends { entityStats?: EntityStatValues }>(state: S, entities: readonly StatEntity[]): S {
  const next = backfillEntityStats(state.entityStats, entities);
  return next === state.entityStats || !Object.keys(next).length ? state : { ...state, entityStats: next };
}

/** The entity owners whose regen and code run, in authored order: every entity in the playthrough that holds
 *  stat values, present or not, the played world persona among them. */
export function entityStatOwners(values: OwnerStats, entities: readonly Entity[], persona: PersonaRef | undefined): StatOwner[] {
  return entities
    .filter((entity) => values[entity.id] && (inCast(entity, persona) || playsAs(entity, persona)))
    .map((entity) => ({ id: entity.id, stats: values[entity.id], enabled: activeStatEnabled(values[entity.id], ENTITY_STAT_TRAITS) }));
}
