// An entity's owned stats, stat groups and stat Links off-world: named on the way out, bound to a receiving
// world's Blueprints on the way in, as portableTraits does for traits.

import type { Entity, Stat, StatGroup, StatLink } from '@/types';
import { rekeyed, uniqueNamed } from './carriedBinding';
import { playStatWorld, statBroughtIds, statOriginalOf, withStatLinks } from './statLinks';

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

/** The world stat or group a Link's original id names, when it is of the Link's kind. */
const itemOf = (world: { stats: readonly Stat[]; statGroups: readonly StatGroup[] }, link: StatLink): { id: string; name: string } | undefined =>
  (link.kind === 'group' ? world.statGroups : world.stats).find((item) => item.id === link.originalId);

/** Each Link naming its original, and each other stat its overrides key, by the world's names, so a receiving
 *  world can rebind them. */
function portableLinks(links: readonly StatLink[], world?: StatWorld): StatLink[] {
  const bound = world && linkWorld(world);
  return links.map((link) => {
    const original = bound && itemOf(bound, link);
    const keyNames = Object.fromEntries(Object.keys(link.overrides ?? {}).filter((id) => id !== link.originalId).flatMap((id) => {
      const name = bound?.stats.find((s) => s.id === id)?.name ?? link.keyNames?.[id];
      return name ? [[id, name] as const] : [];
    }));
    const { keyNames: _stored, ...rest } = link;
    return { ...rest, originalName: original ? original.name : link.originalName, ...(Object.keys(keyNames).length ? { keyNames } : {}) };
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
 * The entity's stat Links bound to `world`: each by its original's id when that is a Blueprint stat or group of
 * the Link's kind, else by the one such original carrying its stored name, else dropped. A Link that brings
 * anything an earlier Link already brings is dropped too, as the resolver keeps the first. Each override key
 * follows the same rule inside what the bound original brings. The entity as it is when `world` carries no stats.
 */
export function bindOwnedStats(entity: Entity, world: StatWorld): Entity {
  const bound = linkWorld(world);
  if (!entity.statLinks?.length || !bound) return entity;
  const taken = new Set<string>();
  const links = entity.statLinks.flatMap((link): StatLink[] => {
    const found = bindStatLink(link, bound);
    if (!found || found.ids.some((id) => taken.has(id))) return [];
    found.ids.forEach((id) => taken.add(id));
    return [found.link];
  });
  return withStatLinks(entity, links);
}

type LinkWorld = NonNullable<ReturnType<typeof linkWorld>>;

/** One Link bound to the world's Blueprints, with the ids it brings; null when no Blueprint of its kind matches
 *  by id or by its stored name. */
function bindStatLink(link: StatLink, bound: LinkWorld): { link: StatLink; ids: string[] } | null {
  const list = (link.kind === 'group' ? bound.statGroups : bound.stats).filter((item) => statOriginalOf(bound, item.id));
  const original = list.find((item) => item.id === link.originalId) ?? uniqueNamed(list, link.originalName);
  if (!original) return null;
  const ids = statBroughtIds(bound, original.id);
  const stats = bound.stats.filter((s) => ids.includes(s.id));
  const key = (id: string): string | null => {
    if (id === link.originalId) return original.id;
    if (stats.some((s) => s.id === id)) return id;
    return uniqueNamed(stats, link.keyNames?.[id])?.id ?? null;
  };
  const overrides = rekeyed(link.overrides, key);
  const { overrides: _stored, keyNames: _k, ...rest } = link;
  return { ids, link: { ...rest, originalId: original.id, ...(overrides ? { overrides } : {}) } };
}

/** A library entity's Links as the world it is opened in reads them: each that binds takes the world's ids, and
 *  one that does not stays as stored. Nothing is dropped, since the entity stays in the library. */
export function statLinksBoundTo(entity: Entity, world: StatWorld): Entity {
  const bound = linkWorld(world);
  if (!entity.statLinks?.length || !bound) return entity;
  return withStatLinks(entity, entity.statLinks.map((link) => bindStatLink(link, bound)?.link ?? link));
}

/** A library entity's Links as the library stores them, named from the world it is opened in. */
export const statLinksCarriedFrom = (entity: Entity, world: StatWorld): Entity =>
  (entity.statLinks?.length ? withStatLinks(entity, portableLinks(entity.statLinks, world)) : entity);

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
      overrides: rekeyed(link.overrides, (id) => (id === link.originalId ? '' : link.keyNames?.[id] ?? id)),
    })),
  } : {});
