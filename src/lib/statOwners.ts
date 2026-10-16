// Stat owners: whose stats the runtime moves, global scope's and each entity's, and how each owner's traits
// switch them.

import type { PlayerStat, Trait } from '@/types';
import { applyRegen } from './statChanges';
import { activeStatEnabled } from './traitEffects';
import type { Scoped } from './scope';

/** Runtime stat values by entity owner id, each owner's stats in their own order. A stat id is unique only
 *  within its owner. */
export type OwnerStats = Readonly<Record<string, readonly PlayerStat[]>>;

/** Every stat value in play in two parts: the global stats, and each entity's by its id. */
export const statScope = (state: { stats: readonly PlayerStat[]; entityStats?: OwnerStats }): Scoped<readonly PlayerStat[]> =>
  ({ global: state.stats, owners: state.entityStats ?? {} });

/** One owner as the stat runtime reads it. */
export interface StatOwner {
  id: string;
  stats: readonly PlayerStat[];
  /** The owner's stat-enabled map, by stat id. A stat it leaves out is on. */
  enabled: Readonly<Record<string, boolean>>;
}

/** One owner's stats; none for an owner the map does not hold. */
export const statsOf = (owners: OwnerStats, ownerId: string): readonly PlayerStat[] => owners[ownerId] ?? [];

/** Each owner's stats that are switched on, as the prompts read them; an owner left with none is dropped. */
export function enabledOwnerStats(owners: OwnerStats): Record<string, PlayerStat[]> {
  const out: Record<string, PlayerStat[]> = {};
  for (const [id, stats] of Object.entries(owners)) {
    const live = stats.filter((stat) => stat.enabled !== false);
    if (live.length) out[id] = live;
  }
  return out;
}

/** An owner's stat traits in force, by owner id. */
export type OwnerStatTraits = (ownerId: string) => readonly Trait[];

/** Each owner's stats with `enabled` as its traits in force switch them, for readers that filter on it. The
 *  stored values keep the author's own switch. The same map when no trait switches anything. */
export function withTraitToggles(values: OwnerStats, inForce: OwnerStatTraits): OwnerStats {
  let out: Record<string, readonly PlayerStat[]> | null = null;
  for (const [id, stats] of Object.entries(values)) {
    const enabled = activeStatEnabled(stats, inForce(id));
    if (stats.every((s) => enabled[s.id] === (s.enabled !== false))) continue;
    (out ??= { ...values })[id] = stats.map((s) => (enabled[s.id] === (s.enabled !== false) ? s : { ...s, enabled: enabled[s.id] }));
  }
  return out ?? values;
}

/** One regen tick over `hours` for each owner. `applied` is what each stat moved, by owner, then stat id. */
export function regenOwners(
  owners: readonly StatOwner[],
  hours: number,
): { stats: OwnerStats; applied: Readonly<Record<string, Readonly<Record<string, number>>>> } {
  const stats: Record<string, readonly PlayerStat[]> = {};
  const applied: Record<string, Record<string, number>> = {};
  for (const owner of owners) {
    const tick = applyRegen(owner.stats, hours, owner.enabled);
    stats[owner.id] = tick.stats;
    applied[owner.id] = tick.applied;
  }
  return { stats, applied };
}
