// Entity stats in play: each authored entity's stat values, seeded at a new game and backfilled on load, and
// the owners whose regen and code run each turn.

import type { Entity, EntityStatChanges, EntityStatValues, LegacyCodeBoundsStat, PersonaRef, PlayerStat, Stat, StatGroup } from '@/types';
import { playStatWorld, type StatLinkWorld } from './statLinks';
import { inCast, playsAs } from './owners';
import { backfillPlayerStats } from './statBackfill';
import { activeStatEnabled, enabledStats } from './traitEffects';
import { seedNewGameStats } from './traitRuntime';
import { regenOwners, statsOf, type OwnerStats, type OwnerStatTraits, type StatOwner } from './statOwners';
import { statPlacementOf } from './statContext';
import { applyStatResponse, type StatRequestOwner, type StatResponse, type StatUpdateDiagnostic } from './statRequest';
import { changedAnyStat, overlayStatCodeResult, type OwnerCodeResult, type OwnerCodeTurn } from './statCodeTurn';

type StatEntity = Pick<Entity, 'id' | 'stats'>;

/** Each entity's own stats as a new game seeds them, its links resolved against the world's stats. */
export const seedWorldEntityStats = (world: StatLinkWorld & { stats: Stat[]; entities: Entity[] }): EntityStatValues =>
  seedEntityStats(playStatWorld(world).entities);

/** Every entity that can own stats in a playthrough: the world's, then the library's, which are the library
 *  persona and the characters added at Enter World. */
export const statOwnerEntities = (entities: { world: readonly Entity[]; library: readonly Entity[] }): Entity[] =>
  [...entities.world, ...entities.library];

/** Each authored entity that owns stats, every stat seeded as a new game seeds the player's. */
export const seedEntityStats = (entities: readonly StatEntity[]): EntityStatValues =>
  Object.fromEntries(entities.filter((e) => e.stats?.length).map((e) => [e.id, seedNewGameStats(e.stats ?? [])]));

/** `saved` with each authored stat it lacks added at its start value, owner by owner, as the player's stats
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

/** `values` with `ownerId`'s stat `statId` set to `value`; the same map when the owner lacks that stat. */
export function withEntityStatValue(values: EntityStatValues, ownerId: string, statId: string, value: number): EntityStatValues {
  const rows = values[ownerId];
  if (!rows?.some((s) => s.id === statId)) return values;
  return { ...values, [ownerId]: rows.map((s) => (s.id === statId ? { ...s, value } : s)) };
}

/** `values` after one regen tick over `hours` for each of `owners`; the same map when none runs. */
export function withEntityRegen(values: EntityStatValues, owners: readonly StatOwner[], hours: number): EntityStatValues {
  if (!owners.length) return values;
  const tick = regenOwners(owners, hours);
  return { ...values, ...Object.fromEntries(owners.map((owner) => [owner.id, [...statsOf(tick.stats, owner.id)]])) };
}

/** Each owner's part of a code run. `hours` null is the before box, which takes no regen. `prepare` readies an
 *  owner's stats for the sandbox, after the tick. With `asks`, `owners` hold this turn's AI changes, and
 *  `previous` the values from before them. */
export function entityCodeTurns(
  owners: readonly StatOwner[], hours: number | null, prepare: (ownerId: string, stats: PlayerStat[]) => PlayerStat[],
  { previous, asks }: { previous?: OwnerStats; asks?: Readonly<Record<string, OwnerCodeTurn['asks']>> } = {},
): OwnerCodeTurn[] {
  const tick = hours === null ? null : regenOwners(owners, hours);
  return owners.map((owner) => ({
    id: owner.id,
    stats: prepare(owner.id, tick ? [...statsOf(tick.stats, owner.id)] : [...owner.stats]),
    enabled: owner.enabled,
    previous: previous?.[owner.id] ?? owner.stats,
    regenApplied: tick?.applied[owner.id] ?? {},
    ...(asks?.[owner.id]?.length && { asks: asks[owner.id] }),
  }));
}

/** The present entities whose live stats join the player's in the stat request, each once, in `present` order,
 *  placed as each entity groups its stats. `present` holds the entities the narration confirmed, names
 *  resolved. The played persona stays out. `prepare` readies an owner's live stats for the request, `inForce`
 *  gives the traits that switch them, and `prepareGroups` readies its stat groups. */
export function statRequestOwners(
  present: readonly Entity[], values: OwnerStats, persona: PersonaRef | undefined,
  prepare: (stats: PlayerStat[]) => PlayerStat[], inForce: OwnerStatTraits,
  prepareGroups: (groups: StatGroup[]) => StatGroup[],
): StatRequestOwner[] {
  return requestOwners(present.filter((entity) => inCast(entity, persona)), values, prepare, inForce, prepareGroups);
}

/** The entities whose stats are the player's, each once: the played one from any source, then each of
 *  `world` whose traits are the player's under `persona`, as the Custom Persona entity's are under None and
 *  a library persona. */
export function personaEntities(played: Entity | undefined, world: readonly Entity[], persona: PersonaRef | undefined): Entity[] {
  const out = played ? [played] : [];
  for (const entity of world) if (playsAs(entity, persona) && !out.some((e) => e.id === entity.id)) out.push(entity);
  return out;
}

/** The entities the player plays as whose live stats join the player's in the stat request, each once, in
 *  `personas` order, placed as each entity groups its stats. Arguments as {@link statRequestOwners} takes. */
export const personaStatOwners = (
  personas: readonly Entity[], values: OwnerStats,
  prepare: (stats: PlayerStat[]) => PlayerStat[], inForce: OwnerStatTraits, prepareGroups: (groups: StatGroup[]) => StatGroup[],
): StatRequestOwner[] => requestOwners(personas, values, prepare, inForce, prepareGroups);

function requestOwners(
  entities: readonly Entity[], values: OwnerStats,
  prepare: (stats: PlayerStat[]) => PlayerStat[], inForce: OwnerStatTraits, prepareGroups: (groups: StatGroup[]) => StatGroup[],
): StatRequestOwner[] {
  const seen = new Set<string>();
  return entities.flatMap((entity) => {
    const held = values[entity.id];
    if (!held || seen.has(entity.id)) return [];
    seen.add(entity.id);
    const stats = prepare(enabledStats([...held], activeStatEnabled(held, inForce(entity.id))));
    if (!stats.length) return [];
    const authored = statPlacementOf(entity);
    const placement = { ...authored, groups: prepareGroups([...authored.groups]) };
    return [{ id: entity.id, name: entity.name, stats, placement }];
  });
}

/** `values` with each entity owner's updates from `response` applied, max before value, by identity, bounds
 *  derived under the owner's traits in force. The diagnostics are each owner's own: an owner the playthrough no
 *  longer holds reports every update missing. */
export function applyEntityStatResponse(
  values: EntityStatValues, response: StatResponse, inForce: OwnerStatTraits,
): { values: EntityStatValues; diagnostics: StatUpdateDiagnostic[] } {
  const ownerIds = [...new Set(response.updates.flatMap((u) => (u.ownerId === null ? [] : [u.ownerId])))];
  if (!ownerIds.length) return { values, diagnostics: [] };
  // The response's own diagnostics go out with the global apply, once.
  const updatesOnly = { ...response, diagnostics: [] };
  const next = { ...values };
  const diagnostics: StatUpdateDiagnostic[] = [];
  for (const ownerId of ownerIds) {
    const held = values[ownerId] ?? [];
    const active = inForce(ownerId);
    const live = new Set(enabledStats(held, activeStatEnabled(held, active)).map((s) => s.id));
    const applied = applyStatResponse(held, updatesOnly, live, ownerId);
    if (values[ownerId]) next[ownerId] = applied.stats;
    diagnostics.push(...applied.diagnostics);
  }
  return { values: next, diagnostics };
}

/** What each entity stat moved from `baseline` to `values`, by owner, then stat id. Unmoved stats, and owners
 *  `baseline` lacks, are left out. */
export function entityStatDeltas(values: EntityStatValues, baseline: EntityStatValues): EntityStatChanges {
  const out: EntityStatChanges = {};
  for (const [ownerId, stats] of Object.entries(values)) {
    const before = baseline[ownerId];
    if (!before) continue;
    const moved = Object.fromEntries(stats.flatMap((stat) => {
      const from = before.find((b) => b.id === stat.id);
      return from && from.value !== stat.value ? [[stat.id, stat.value - from.value]] : [];
    }));
    if (Object.keys(moved).length) out[ownerId] = moved;
  }
  return out;
}

/** Each owner's code result laid onto the latest `values`, which may have moved since the run read its
 *  snapshot, re-derived under the owner's traits in force. The same map when no owner moved. */
export function withOwnerCodeResults(
  values: EntityStatValues, results: Readonly<Record<string, OwnerCodeResult>> | undefined, inForce: OwnerStatTraits,
): EntityStatValues {
  const moved = Object.entries(results ?? {})
    .filter(([id, r]) => values[id] && (changedAnyStat(r) || r.inForce));
  if (!moved.length) return values;
  return {
    ...values,
    ...Object.fromEntries(moved.map(([id, r]) => [
      id, overlayStatCodeResult(values[id], r, inForce(id)),
    ])),
  };
}

/** {@link backfillEntityStats} on a saved state; the same state when nothing is missing. */
export function backfillGameStateEntityStats<S extends { entityStats?: EntityStatValues }>(state: S, entities: readonly StatEntity[]): S {
  const next = backfillEntityStats(state.entityStats, entities);
  return next === state.entityStats || !Object.keys(next).length ? state : { ...state, entityStats: next };
}

/** A saved state with no entity stat carrying stored code bounds; the same state when none carries them. */
export function withoutEntityCodeBounds<S extends { entityStats?: EntityStatValues }>(state: S): S {
  const saved = state.entityStats;
  const carries = (stat: LegacyCodeBoundsStat) => 'codeBounds' in stat;
  if (!saved || !Object.values(saved).some((stats) => stats.some(carries))) return state;
  const entityStats = Object.fromEntries(Object.entries(saved).map(([id, stats]) =>
    [id, stats.map((stat: LegacyCodeBoundsStat) => {
      if (!carries(stat)) return stat;
      const { codeBounds: _dropped, ...rest } = stat;
      return rest;
    })]));
  return { ...state, entityStats };
}

/** The entity owners whose regen and code run, in authored order: every entity in the playthrough that holds
 *  stat values, present or not, the played world persona among them. Each owner's traits in force switch its
 *  stats on and off. */
export function entityStatOwners(
  values: OwnerStats, entities: readonly Entity[], persona: PersonaRef | undefined, inForce: OwnerStatTraits,
): StatOwner[] {
  return entities
    .filter((entity) => values[entity.id] && (inCast(entity, persona) || playsAs(entity, persona)))
    .map((entity) => ({ id: entity.id, stats: values[entity.id], enabled: activeStatEnabled(values[entity.id], inForce(entity.id)) }));
}
