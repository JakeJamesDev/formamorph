// The stat sets a stat Condition reads: the global stats and each entity owner's.

import type { Entity, Stat, StatGroup } from '@/types';
import { statMax, statMin, statStartValue } from './statDescriptorGeometry';
import { globalStatsOf, resolvedEntityStats } from './statLinks';
import { scoped } from './scope';
import type { GateStat, GateStats } from './traitGates';

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

/** Every stat at its authored start: the global stats, and each entity's under its id. */
export const startingGateStatsOf = (global: readonly Stat[], entities: Readonly<Record<string, readonly Stat[]>>): GateStats =>
  scoped(byId(global), Object.fromEntries(Object.entries(entities).map(([id, stats]) => [id, byId(stats)])));

/** What the starting stat sets read from a world. */
export interface GateStatWorld {
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
  entities: readonly Entity[];
}

/**
 * Every stat at its authored start, before any trait's stat effects (Q23): the global stats, then each
 * entity's own and linked stats under its id. `library` holds the library entities the playthrough carries.
 */
export function startingGateStats(world: GateStatWorld, library: readonly Entity[] = []): GateStats {
  const linkWorld = { stats: world.stats ?? [], statGroups: world.statGroups ?? [] };
  return startingGateStatsOf(
    globalStatsOf([...linkWorld.stats], linkWorld.statGroups),
    Object.fromEntries([...world.entities, ...library].map((e) => [e.id, resolvedEntityStats(linkWorld, e)])),
  );
}
