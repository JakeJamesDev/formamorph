// The stat sets a stat Condition reads, per gate owner.

import type { Entity, Stat, StatGroup } from '@/types';
import { statMax, statMin, statStartValue } from './statDescriptorGeometry';
import { playerStatsOf, resolvedEntityStats } from './statLinks';
import { WORLD_OWNER, type GateStat, type GateStats } from './traitGates';

/** A stat at its authored start, on its authored min→max. */
export const startingGateStat = (stat: Stat): GateStat => ({
  name: stat.name,
  value: statStartValue(stat),
  min: statMin(stat),
  max: statMax(stat),
  ...(stat.enabled === false ? { inert: true } : {}),
  ...(stat.hidden ? { hidden: true } : {}),
});

const byId = (stats: readonly Stat[]): Record<string, GateStat> =>
  Object.fromEntries(stats.map((s) => [s.id, startingGateStat(s)]));

/** Each owner's stats at their authored start: the player's under the world owner, each entity's under its id. */
export const startingGateStatsOf = (player: readonly Stat[], entities: Readonly<Record<string, readonly Stat[]>>): GateStats => ({
  [WORLD_OWNER]: byId(player),
  ...Object.fromEntries(Object.entries(entities).map(([id, stats]) => [id, byId(stats)])),
});

/** What the starting stat sets read from a world. */
export interface GateStatWorld {
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
  entities: readonly Entity[];
}

/**
 * Every owner's stats at their authored start, before any trait's stat effects (Q23): the player's world stats
 * under the world owner, then each entity's own and linked stats under its id. `library` holds the library
 * entities the playthrough carries.
 */
export function startingGateStats(world: GateStatWorld, library: readonly Entity[] = []): GateStats {
  const linkWorld = { stats: world.stats ?? [], statGroups: world.statGroups ?? [] };
  return startingGateStatsOf(
    playerStatsOf([...linkWorld.stats], linkWorld.statGroups),
    Object.fromEntries([...world.entities, ...library].map((e) => [e.id, resolvedEntityStats(linkWorld, e)])),
  );
}
