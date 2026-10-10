// Stat owners: whose stats the runtime moves. The player is the one owner, and its stats are the
// playthrough's `playerStats`.

import type { PlayerStat } from '@/types';
import { applyRegen } from './statChanges';
import { WORLD_OWNER } from './traitGates';

/** The player's owner id, the one owned traits key the player by. */
export const PLAYER_OWNER = WORLD_OWNER;

/** Runtime stat values by owner id, each owner's stats in their own order. A stat id is unique only
 *  within its owner. */
export type OwnerStats = Readonly<Record<string, readonly PlayerStat[]>>;

/** One owner as the stat runtime reads it. */
export interface StatOwner {
  id: string;
  stats: readonly PlayerStat[];
  /** The owner's stat-enabled map, by stat id. A stat it leaves out is on. */
  enabled: Readonly<Record<string, boolean>>;
}

/** One owner's stats; none for an owner the map does not hold. */
export const statsOf = (owners: OwnerStats, ownerId: string): readonly PlayerStat[] => owners[ownerId] ?? [];

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
