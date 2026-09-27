// Editor edits of an entity's links: removal, the link's own defaults, Detach, and the cascade when an
// original goes.

import type { CustomPersonaNode, Entity, Trait, TraitGroup, TraitLink } from '@/types';
import { randomUUID } from './uuid';
import { originalOf, type BearerWorld } from './bearers';
import { buildTraitTree, flattenTraitTree, groupsBelow, hasStatEffects, isDescendantGroup } from './traitTree';
import { withOwnedTraits } from './ownedTraits';

type WorldTraitLists = Pick<BearerWorld, 'traits' | 'traitGroups'>;

/** The entity with its links replaced. No links are stored as absent. */
function withLinks(entity: Entity, links: TraitLink[]): Entity {
  const { traitLinks: _l, ...rest } = entity;
  return links.length ? { ...rest, traitLinks: links } : rest;
}

/** The world groups from the top down to the original, the original last. Empty when it is gone. */
export function originalPath(world: WorldTraitLists, originalId: string): string[] {
  const original = originalOf(world, originalId);
  if (!original) return [];
  const byId = new Map(world.traitGroups.map((g) => [g.id, g]));
  const path = [original.item.name];
  let at = original.kind === 'trait' ? original.item.groupId : original.item.parentId;
  for (let g = at ? byId.get(at) : undefined; g; at = g.parentId, g = at ? byId.get(at) : undefined) path.unshift(g.name);
  return path;
}

/** The traits a link's row at `originalId` sets defaults for, in tree order, each with its default-on for
 *  this link: the link's own value, else the original's. */
export function linkDefaultTraits(world: WorldTraitLists, link: TraitLink, originalId: string): { trait: Trait; on: boolean }[] {
  const rows = flattenTraitTree(buildTraitTree(world.traitGroups, world.traits));
  return rows
    .filter((r) => r.leaf && (r.id === originalId || (r.leaf.groupId != null && isDescendantGroup([...world.traitGroups], originalId, r.leaf.groupId))))
    .map((r) => ({ trait: r.leaf!, on: link.defaults?.[r.id] ?? !!r.leaf!.isDefault }));
}

/** How many links across `entities` and Custom Persona point at the original. */
export const linksTo = (entities: readonly Entity[], originalId: string, customPersona?: CustomPersonaNode): number =>
  [...entities.map((e) => e.traitLinks ?? []), customPersona?.traitLinks ?? []]
    .reduce((n, links) => n + links.filter((l) => l.originalId === originalId).length, 0);

const linksOriginal = (entity: Entity, originalId: string) => entity.traitLinks?.some((l) => l.originalId === originalId);

/** Custom Persona without its links to the original; the same node when none links it. */
export function dropCustomPersonaLinksTo(node: CustomPersonaNode | undefined, originalId: string): CustomPersonaNode | undefined {
  if (!node?.traitLinks.some((l) => l.originalId === originalId)) return node;
  return { ...node, traitLinks: node.traitLinks.filter((l) => l.originalId !== originalId) };
}

/** Every entity without its links to the original; the same array when none links it. */
export function dropLinksTo(entities: Entity[], originalId: string): Entity[] {
  if (!entities.some((e) => linksOriginal(e, originalId))) return entities;
  return entities.map((e) =>
    (linksOriginal(e, originalId) ? withLinks(e, e.traitLinks!.filter((l) => l.originalId !== originalId)) : e));
}

/** Remove one link. The original is untouched. */
export const removeLink = (entity: Entity, linkId: string): Entity =>
  withLinks(entity, (entity.traitLinks ?? []).filter((l) => l.id !== linkId));

/** Store the link's own default-on for one original trait it brings. */
export const setLinkDefault = (entity: Entity, linkId: string, traitId: string, on: boolean): Entity =>
  withLinks(entity, (entity.traitLinks ?? []).map((l) => (l.id === linkId ? { ...l, defaults: { ...l.defaults, [traitId]: on } } : l)));

/** The original and, for a group, its live subtree. */
function brought(world: WorldTraitLists, link: TraitLink): { groups: TraitGroup[]; traits: Trait[] } | null {
  const original = originalOf(world, link.originalId);
  if (!original) return null;
  if (original.kind === 'trait') return { groups: [], traits: [original.item] };
  const groups = [original.item, ...groupsBelow(world.traitGroups, original.item.id)];
  const ids = new Set(groups.map((g) => g.id));
  return { groups, traits: world.traits.filter((t) => t.groupId != null && ids.has(t.groupId)) };
}

/** Whether Detach would leave stat changes or stat toggles behind, which an owned trait can't carry. */
export const detachDropsStats = (world: WorldTraitLists, link: TraitLink): boolean =>
  brought(world, link)?.traits.some(hasStatEffects) ?? false;

/**
 * Replace a link with an owned copy of what it brings, in the link's place, under new ids. The copy takes
 * the link's defaults and leaves stat effects behind. Null when the link or its original is gone.
 */
export function detachLink(world: WorldTraitLists, entity: Entity, linkId: string): { entity: Entity; newId: string } | null {
  const link = entity.traitLinks?.find((l) => l.id === linkId);
  const items = link && brought(world, link);
  if (!link || !items) return null;
  const ids = new Map([...items.groups, ...items.traits].map((x) => [x.id, randomUUID()] as const));
  // The original takes the link's place; everything below it keeps its place inside the copy.
  const isOriginal = (id: string) => id === link.originalId;
  const traits = items.traits.map((t): Trait => {
    const { statToggles: _s, ...rest } = t;
    return {
      ...rest,
      id: ids.get(t.id)!,
      groupId: isOriginal(t.id) ? link.groupId : ids.get(t.groupId!)!,
      order: isOriginal(t.id) ? link.order ?? 0 : t.order,
      statChanges: [],
      isDefault: link.defaults?.[t.id] ?? t.isDefault,
      ...(t.requires ? { requires: t.requires.map((r) => (r.kind === 'trait' && ids.has(r.id) ? { ...r, id: ids.get(r.id)! } : r)) } : {}),
    };
  });
  const groups = items.groups.map((g): TraitGroup => ({
    ...g,
    id: ids.get(g.id)!,
    parentId: isOriginal(g.id) ? link.groupId : ids.get(g.parentId!)!,
    order: isOriginal(g.id) ? link.order ?? 0 : g.order,
  }));
  const owned = withOwnedTraits(entity, [...(entity.traits ?? []), ...traits], [...(entity.traitGroups ?? []), ...groups]);
  return { entity: removeLink(owned, linkId), newId: ids.get(link.originalId)! };
}
