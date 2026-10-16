// An entity's owned stats, stat groups and stat Links off-world: named on the way out, bound to a receiving
// world's Blueprints on the way in, as portableTraits does for traits.

import type { Entity, Stat, StatGroup, StatLink } from '@/types';
import { bindLinks, comparableLink, linksBound, portableLinks, type ComparableLink, type LinkLists } from './portableLinks';
import { playStatWorld, statBroughtIds, statLinksInTreeOrder, statOriginalOf, withStatLinks } from './statLinks';
import { migrateStatLinkBoxes } from './scripts';

/** The world's stat lists a stat Link can point into. A record with no `stats` carries none, so its Links stay
 *  as they are stored. */
export interface StatWorld {
  stats?: readonly Stat[];
  statGroups?: readonly StatGroup[];
}

/** The entity fields that carry its owned stats. */
export type OwnedStatFields = Pick<Entity, 'stats' | 'statGroups' | 'statLinks'>;

const linkWorld = (world: StatWorld): { stats: readonly Stat[]; statGroups: readonly StatGroup[] } | null =>
  (world.stats ? { stats: world.stats, statGroups: world.statGroups ?? [] } : null);

/** The world's stat lists as its Links read them; none when `world` carries no stats. A Link binds only to a
 *  Blueprint stat or group. */
function statLists(world: StatWorld): LinkLists<StatLink> | undefined {
  const bound = linkWorld(world);
  if (!bound) return undefined;
  const listOf = (kind: StatLink['kind']) => (kind === 'group' ? bound.statGroups : bound.stats);
  return {
    originalNamed: (link) => listOf(link.kind).find((item) => item.id === link.originalId),
    originals: (kind) => listOf(kind).filter((item) => statOriginalOf(bound, item.id)),
    leaves: bound.stats,
    brought: (original) => {
      const ids = statBroughtIds(bound, original.id);
      return { ids, leaves: bound.stats.filter((s) => ids.includes(s.id)) };
    },
    // A card's or a library entity's old box overrides fold here, where the original is in reach (Q36).
    finish: (link) => migrateStatLinkBoxes(link, (id) => bound.stats.find((s) => s.id === id)),
  };
}

/** The entity's owned stats, groups and Links as they travel: each Link stores its original's name. */
export function portableOwnedStats(entity: Entity, world?: StatWorld): OwnedStatFields {
  return {
    ...(entity.stats?.length ? { stats: entity.stats } : {}),
    ...(entity.statGroups?.length ? { statGroups: entity.statGroups } : {}),
    ...(entity.statLinks?.length ? { statLinks: portableLinks(entity.statLinks, world && statLists(world)) } : {}),
  };
}

/**
 * The entity's stat Links bound to `world` as {@link bindLinks} binds them, with old code-box overrides folded
 * into scripts. The entity as it is when `world` carries no stats.
 */
export function bindOwnedStats(entity: Entity, world: StatWorld): Entity {
  const lists = statLists(world);
  if (!entity.statLinks?.length || !lists) return entity;
  return withStatLinks(entity, bindLinks(entity.statLinks, statLinksInTreeOrder(entity), lists));
}

/** A library entity's Links as the world it is opened in reads them: each that binds takes the world's ids, and
 *  one that does not stays as stored. Nothing is dropped, since the entity stays in the library. */
export function statLinksBoundTo(entity: Entity, world: StatWorld): Entity {
  const lists = statLists(world);
  if (!entity.statLinks?.length || !lists) return entity;
  return withStatLinks(entity, linksBound(entity.statLinks, lists));
}

/** A library entity's Links as the library stores them, named from the world it is opened in. */
export const statLinksCarriedFrom = (entity: Entity, world: StatWorld): Entity =>
  (entity.statLinks?.length ? withStatLinks(entity, portableLinks(entity.statLinks, statLists(world))) : entity);

/** The entity as play reads it: its Links bound to `world` and then resolved into its own stat list, so a
 *  library entity runs exactly as an authored entity does. The entity as it is without Links. */
export function playLibraryStats(entity: Entity, world: StatWorld): Entity {
  const bound = bindOwnedStats(entity, world);
  const linked = linkWorld(world);
  if (!bound.statLinks?.length || !linked) return bound;
  return playStatWorld({ ...linked, stats: [...linked.stats], entities: [bound] }).entities[0];
}

/** The entity's stat Links as two copies compare them. */
export const comparableOwnedStats = (entity: Entity): { statLinks?: ComparableLink<StatLink>[] } =>
  (entity.statLinks?.length ? { statLinks: entity.statLinks.map(comparableLink) } : {});
