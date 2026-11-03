import { canBePlayer } from '@/lib/owners';
import { globalStatsOf, resolvedEntityStats, statBlueprintIds, type StatLinkWorld } from '@/lib/statLinks';
import type { Entity, Stat } from '@/types';

/** One heading of the stat picker. `persona` holds that Persona's own stats. */
export type CurrencyStatGroup = { stats: Stat[] } & ({ kind: 'global' | 'linked' } | { kind: 'persona'; persona: Entity });

/** What can back a Currency, each stat once: Global Stats, linked Blueprint stats under their original ids, then each Persona's own (Q30). */
export function currencyStatGroups(world: StatLinkWorld & { entities: readonly Entity[] }): CurrencyStatGroup[] {
  const blueprints = statBlueprintIds(world);
  const personas = world.entities.filter(canBePlayer).map((persona) => ({ persona, stats: resolvedEntityStats(world, persona) }));
  const linked = new Map(personas.flatMap(({ stats }) => stats.filter((stat) => blueprints.has(stat.id)).map((stat) => [stat.id, stat] as const)));
  const seen = new Set(blueprints);
  const firstSeen = (stat: Stat) => !seen.has(stat.id) && !!seen.add(stat.id);
  const groups: CurrencyStatGroup[] = [
    { kind: 'global', stats: globalStatsOf([...world.stats], world.statGroups).filter(firstSeen) },
    { kind: 'linked', stats: [...linked.values()] },
    ...personas.map(({ persona, stats }) => ({ kind: 'persona' as const, persona, stats: stats.filter(firstSeen) })),
  ];
  return groups.filter((group) => group.stats.length > 0);
}
