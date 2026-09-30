// Editor edits of an entity's links: removal, the link's overrides, Detach, and the cascade when an
// original goes.

import type { Entity, Trait, TraitGroup, TraitLink, TraitLinkFields } from '@/types';
import { randomUUID } from './uuid';
import { broughtIds, makeLink, originalOf, type BearerWorld } from './bearers';
import {
  effectiveLinkTrait, resetLinkOverride, resetLinkOverrides, resetLinkTraitOverrides, setLinkEdits, setLinkOverride,
} from './blueprints';
import { blueprintItemIds, blueprintsGroup, buildTraitTree, canOwnStatTraits, flattenTraitTree, groupsBelow, hasStatEffects, isBlueprintItem, isDescendantGroup } from './traitTree';
import { rootCount, withOwnedTraits } from './ownedTraits';

type WorldTraitLists = Pick<BearerWorld, 'traits' | 'traitGroups'>;

/** The entity with its links replaced. No links are stored as absent. */
function withLinks(entity: Entity, links: TraitLink[]): Entity {
  const { traitLinks: _l, ...rest } = entity;
  return links.length ? { ...rest, traitLinks: links } : rest;
}

/** The entity with one link rewritten through `edit`. */
const withLink = (entity: Entity, linkId: string, edit: (link: TraitLink) => TraitLink): Entity =>
  withLinks(entity, (entity.traitLinks ?? []).map((l) => (l.id === linkId ? edit(l) : l)));

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

/** The traits a link's row at `originalId` brings, in tree order, each as the link reads it. */
export function linkedTraits(world: WorldTraitLists, link: TraitLink, originalId: string): Trait[] {
  const rows = flattenTraitTree(buildTraitTree(world.traitGroups, world.traits));
  return rows
    .filter((r) => r.leaf && (r.id === originalId || (r.leaf.groupId != null && isDescendantGroup([...world.traitGroups], originalId, r.leaf.groupId))))
    .map((r) => effectiveLinkTrait(r.leaf!, link));
}

/** How many links across `entities` point at the originals. */
export function linksTo(entities: readonly Entity[], originalIds: string | ReadonlySet<string>): number {
  const at = typeof originalIds === 'string' ? new Set([originalIds]) : originalIds;
  return entities.reduce((n, e) => n + (e.traitLinks ?? []).filter((l) => at.has(l.originalId)).length, 0);
}

/** Every entity without its links to the originals; the same array when none links one. */
export function dropLinksTo(entities: Entity[], originalIds: string | ReadonlySet<string>): Entity[] {
  const gone = typeof originalIds === 'string' ? new Set([originalIds]) : originalIds;
  const linksGone = (e: Entity) => e.traitLinks?.some((l) => gone.has(l.originalId));
  if (!entities.some(linksGone)) return entities;
  return entities.map((e) => (linksGone(e) ? withLinks(e, e.traitLinks!.filter((l) => !gone.has(l.originalId))) : e));
}

/** Link the original at the end of the bearer's top level. Null when the id is not a Blueprints item. */
export function addLink(world: WorldTraitLists, bearer: Entity, originalId: string, id: string): Entity | null {
  if (!isBlueprintItem(world, originalId)) return null;
  const link = makeLink(world, originalId, id, { groupId: null, order: rootCount(bearer) });
  return link && withLinks(bearer, [...(bearer.traitLinks ?? []), link]);
}

/** Remove one link. The original is untouched. */
export const removeLink = (entity: Entity, linkId: string): Entity =>
  withLinks(entity, (entity.traitLinks ?? []).filter((l) => l.id !== linkId));

/** Override one field on an original trait the link brings; the original's current value is the snapshot.
 *  The entity as it is when the trait is not a world trait. */
export function setLinkField<K extends keyof TraitLinkFields>(
  world: WorldTraitLists, entity: Entity, linkId: string, traitId: string, field: K, value: TraitLinkFields[K],
): Entity {
  const trait = world.traits.find((t) => t.id === traitId);
  return trait ? withLink(entity, linkId, (l) => setLinkOverride(l, trait, field, value)) : entity;
}

/** Write an editor's edit of one trait the link brings as the link's overrides on the fields it changed. The
 *  entity as it is when the trait is not a world trait. */
export function editLinkTrait(world: WorldTraitLists, entity: Entity, linkId: string, traitId: string, edited: Trait): Entity {
  const trait = world.traits.find((t) => t.id === traitId);
  return trait ? withLink(entity, linkId, (l) => setLinkEdits(l, trait, edited)) : entity;
}

/** Read one trait of a linked group live again. */
export const resetLinkTrait = (entity: Entity, linkId: string, traitId: string): Entity =>
  withLink(entity, linkId, (l) => resetLinkTraitOverrides(l, traitId));

/** Read one field on one trait live again. */
export const resetLinkField = (entity: Entity, linkId: string, traitId: string, field: keyof TraitLinkFields): Entity =>
  withLink(entity, linkId, (l) => resetLinkOverride(l, traitId, field));

/** Read the whole original live again: Reset to Blueprint. */
export const resetLink = (entity: Entity, linkId: string): Entity => withLink(entity, linkId, resetLinkOverrides);

/** The original and, for a group, its live subtree. */
function brought(world: WorldTraitLists, link: TraitLink): { groups: TraitGroup[]; traits: Trait[] } | null {
  const original = originalOf(world, link.originalId);
  if (!original) return null;
  if (original.kind === 'trait') return { groups: [], traits: [original.item] };
  const groups = [original.item, ...groupsBelow(world.traitGroups, original.item.id)];
  const ids = new Set(groups.map((g) => g.id));
  return { groups, traits: world.traits.filter((t) => t.groupId != null && ids.has(t.groupId)) };
}

/** Whether Detach would leave stat changes or stat toggles behind: the entity can't own them. */
export const detachDropsStats = (world: WorldTraitLists, entity: Entity, link: TraitLink): boolean =>
  !canOwnStatTraits(entity) && (brought(world, link)?.traits.some((t) => hasStatEffects(effectiveLinkTrait(t, link))) ?? false);

/**
 * Replace a link with an owned copy of what it brings, in the link's place, under new ids. The copy takes
 * each trait as the link reads it; stat effects stay only on an entity that can own them. Null when the link
 * or its original is gone.
 */
export function detachLink(world: WorldTraitLists, entity: Entity, linkId: string): { entity: Entity; newId: string } | null {
  const link = entity.traitLinks?.find((l) => l.id === linkId);
  const items = link && brought(world, link);
  if (!link || !items) return null;
  const ids = new Map([...items.groups, ...items.traits].map((x) => [x.id, randomUUID()] as const));
  const keepStats = canOwnStatTraits(entity);
  // The original takes the link's place; everything below it keeps its place inside the copy.
  const isOriginal = (id: string) => id === link.originalId;
  const traits = items.traits.map((t): Trait => {
    const { statToggles, ...rest } = effectiveLinkTrait(t, link);
    return {
      ...rest,
      id: ids.get(t.id)!,
      groupId: isOriginal(t.id) ? link.groupId : ids.get(t.groupId!)!,
      order: isOriginal(t.id) ? link.order ?? 0 : t.order,
      statChanges: keepStats ? rest.statChanges : [],
      ...(keepStats && statToggles ? { statToggles } : {}),
      ...(rest.requires ? { requires: rest.requires.map((r) => (r.kind === 'trait' && ids.has(r.id) ? { ...r, id: ids.get(r.id)! } : r)) } : {}),
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

/** The world and entities after the Blueprints group goes, with what the confirmation reports. */
export interface BlueprintsRemoval {
  traits: Trait[];
  traitGroups: TraitGroup[];
  entities: Entity[];
  /** Links turned into their entity's own copy. */
  detached: number;
  /** Entities whose copies lose stat effects, in entity order. */
  strippedOn: string[];
  /** Whether any unlinked item moves to the top level. */
  movedUp: boolean;
}

/**
 * Remove the Blueprints group item by item: each link into it is detached into its entity, the linked items
 * and everything below them are deleted, and the rest move to the top level. Null without a Blueprints group.
 */
export function removeBlueprints(world: WorldTraitLists, entities: readonly Entity[]): BlueprintsRemoval | null {
  const bp = blueprintsGroup(world.traitGroups);
  if (!bp) return null;
  const items = blueprintItemIds(world);
  const gone = new Set<string>();
  const strippedOn: string[] = [];
  let detached = 0;
  const entitiesOut = entities.map((entity) => {
    let next = entity;
    for (const link of entity.traitLinks ?? []) {
      if (!items.has(link.originalId)) continue;
      broughtIds(world, link.originalId).forEach((id) => gone.add(id));
      if (detachDropsStats(world, next, link) && !strippedOn.includes(entity.name)) strippedOn.push(entity.name);
      const res = detachLink(world, next, link.id);
      if (res) { next = res.entity; detached += 1; }
    }
    return next;
  });
  const traits = world.traits.filter((t) => !gone.has(t.id)).map((t) => (t.groupId === bp.id ? { ...t, groupId: null } : t));
  const traitGroups = world.traitGroups
    .filter((g) => g.id !== bp.id && !gone.has(g.id))
    .map((g) => (g.parentId === bp.id ? { ...g, parentId: null } : g));
  const movedUp = [...traits, ...traitGroups].some((item) => items.has(item.id));
  return { traits, traitGroups, entities: entitiesOut, detached, strippedOn, movedUp };
}
