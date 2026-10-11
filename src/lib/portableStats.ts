// An entity's owned stats, stat groups and stat Links off-world: named on the way out, bound to a receiving
// world's Blueprints on the way in, as portableTraits does for traits.

import type { Entity, Stat, StatGroup, StatLink } from '@/types';
import { rekeyed, uniqueNamed } from './carriedBinding';
import { playStatWorld, statBlueprintIds, withStatLinks } from './statLinks';

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

/** Each Link naming its original by the world's name for it, so a receiving world can rebind it. */
function portableLinks(links: readonly StatLink[], world?: StatWorld): StatLink[] {
  const bound = world && linkWorld(world);
  return links.map((link) => {
    const original = bound?.stats.find((s) => s.id === link.originalId);
    return original ? { ...link, originalName: original.name } : link;
  });
}

/** The entity's owned stats, groups and Links as they travel: each Link stores its original's name. */
export function portableOwnedStats(entity: Entity, world?: StatWorld): OwnedStatFields {
  return {
    ...(entity.stats?.length ? { stats: entity.stats } : {}),
    ...(entity.statGroups?.length ? { statGroups: entity.statGroups } : {}),
    ...(entity.statLinks?.length ? { statLinks: portableLinks(entity.statLinks, world) } : {}),
  };
}

/**
 * The entity's stat Links bound to `world`: each by its original's id when that is a Blueprint stat, else by
 * the one Blueprint stat carrying its stored name, else dropped. A Link to an original an earlier Link already
 * took is dropped too, as the resolver keeps the first. The Link's overrides follow its original. The entity as
 * it is when `world` carries no stats.
 */
export function bindOwnedStats(entity: Entity, world: StatWorld): Entity {
  const bound = linkWorld(world);
  if (!entity.statLinks?.length || !bound) return entity;
  const linkable = statBlueprintIds(bound);
  const blueprints = bound.stats.filter((s) => linkable.has(s.id));
  const taken = new Set<string>();
  const links = entity.statLinks.flatMap((link): StatLink[] => {
    const original = blueprints.find((s) => s.id === link.originalId) ?? uniqueNamed(blueprints, link.originalName);
    if (!original || taken.has(original.id)) return [];
    taken.add(original.id);
    const overrides = rekeyed(link.overrides, (id) => (id === link.originalId ? original.id : null));
    const { overrides: _stored, ...rest } = link;
    return [{ ...rest, originalId: original.id, ...(overrides ? { overrides } : {}) }];
  });
  return withStatLinks(entity, links);
}

/** The entity as play reads it: its Links bound to `world` and then resolved into its own stat list, so a
 *  library entity runs exactly as an authored entity does. The entity as it is without Links. */
export function playLibraryStats(entity: Entity, world: StatWorld): Entity {
  const bound = bindOwnedStats(entity, world);
  const linked = linkWorld(world);
  if (!bound.statLinks?.length || !linked) return bound;
  return playStatWorld({ ...linked, stats: [...linked.stats], entities: [bound] }).entities[0];
}

/** A Link as two copies compare it: its original by name, since the ids are each world's own. */
type ComparableLink = Pick<StatLink, 'id' | 'kind' | 'originalName' | 'groupId' | 'order' | 'overrides'>;

/** The entity's stat Links as two copies compare them. */
export const comparableOwnedStats = (entity: Entity): { statLinks?: ComparableLink[] } =>
  (entity.statLinks?.length ? {
    statLinks: entity.statLinks.map((link) => ({
      id: link.id, kind: link.kind, originalName: link.originalName, groupId: link.groupId ?? null, order: link.order,
      overrides: rekeyed(link.overrides, (id) => (id === link.originalId ? '' : id)),
    })),
  } : {});
