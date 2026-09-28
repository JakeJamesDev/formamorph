// Traits an entity owns: pure edits of one entity's own trait tree, and the gate input that sees every owner.

import type { Entity, Trait, TraitGroup, TraitRequirement } from '@/types';
import { randomUUID } from './uuid';
import { newTrait } from './blankWorld';
import { WORLD_OWNER, type GateOwner } from './traitGates';
import { effectivePlacement, offeredWorldTraits, ownsTraits, placeableGroupIds } from './traitTree';

const traitsOf = (entity: Entity): Trait[] => entity.traits ?? [];
const groupsOf = (entity: Entity): TraitGroup[] => entity.traitGroups ?? [];

/** The entity with its owned lists replaced. An empty list is stored as absent. */
export function withOwnedTraits(entity: Entity, traits: Trait[], groups: TraitGroup[]): Entity {
  const { traits: _t, traitGroups: _g, ...rest } = entity;
  return { ...rest, ...(traits.length ? { traits } : {}), ...(groups.length ? { traitGroups: groups } : {}) };
}

/** How many items sit at the entity's root: owned traits and groups, and links. */
export const rootCount = (entity: Entity): number =>
  traitsOf(entity).filter((t) => (t.groupId ?? null) === null).length
  + groupsOf(entity).filter((g) => g.parentId === null).length
  + (entity.traitLinks ?? []).filter((l) => (l.groupId ?? null) === null).length;

/** Append a new trait at the entity's root. */
export const addOwnedTrait = (entity: Entity, id: string, name?: string): Entity =>
  withOwnedTraits(entity, [...traitsOf(entity), newTrait(id, rootCount(entity), name)], groupsOf(entity));

/** Append a new group at the entity's root. */
export const addOwnedGroup = (entity: Entity, id: string, name = 'New Group'): Entity =>
  withOwnedTraits(entity, traitsOf(entity), [
    ...groupsOf(entity),
    { id, name, playerDescription: '', aiDescription: '', parentId: null, order: rootCount(entity) },
  ]);

export const updateOwnedTrait = (entity: Entity, trait: Trait): Entity =>
  withOwnedTraits(entity, traitsOf(entity).map((t) => (t.id === trait.id ? trait : t)), groupsOf(entity));

export const updateOwnedGroup = (entity: Entity, group: TraitGroup): Entity =>
  withOwnedTraits(entity, traitsOf(entity), groupsOf(entity).map((g) => (g.id === group.id ? group : g)));

/** Remove an owned trait, or an owned group whose children move up to its parent. */
export function removeOwnedItem(entity: Entity, id: string): Entity {
  const group = groupsOf(entity).find((g) => g.id === id);
  if (!group) return withOwnedTraits(entity, traitsOf(entity).filter((t) => t.id !== id), groupsOf(entity));
  return withOwnedTraits(
    entity,
    traitsOf(entity).map((t) => (t.groupId === id ? { ...t, groupId: group.parentId } : t)),
    groupsOf(entity).filter((g) => g.id !== id).map((g) => (g.parentId === id ? { ...g, parentId: group.parentId } : g)),
  );
}

/** The writes a trait store over one entity makes, each through `edit` on that entity. */
export function ownedTraitWrites(edit: (change: (entity: Entity) => Entity) => void) {
  return {
    setTraits: (next: Trait[]) => edit((e) => withOwnedTraits(e, next, groupsOf(e))),
    setTraitGroups: (next: TraitGroup[]) => edit((e) => withOwnedTraits(e, traitsOf(e), next)),
    updateTrait: (trait: Trait) => edit((e) => updateOwnedTrait(e, trait)),
    updateTraitGroup: (group: TraitGroup) => edit((e) => updateOwnedGroup(e, group)),
    removeTrait: (id: string) => edit((e) => removeOwnedItem(e, id)),
    removeTraitGroup: (id: string) => edit((e) => removeOwnedItem(e, id)),
  };
}

/** The entity that owns trait or group `id`, with the item itself. */
export function findOwnedItem(
  entities: readonly Entity[], id: string,
): { entity: Entity; trait?: Trait; group?: TraitGroup } | null {
  for (const entity of entities) {
    const trait = entity.traits?.find((t) => t.id === id);
    if (trait) return { entity, trait };
    const group = entity.traitGroups?.find((g) => g.id === id);
    if (group) return { entity, group };
  }
  return null;
}

/** A copy of the entity whose owned traits and groups have fresh ids, so the copy shares none with the
 *  source. Requirements that point inside the entity follow; ones that point out of it keep their target.
 *  `entityIds` maps each copied entity to its copy, so "playing as" the source becomes "playing as" the copy. */
export function remintOwnedTraits(entity: Entity, entityIds: ReadonlyMap<string, string> = new Map()): Entity {
  const links = entity.traitLinks ?? [];
  if (!entity.traits?.length && !entity.traitGroups?.length && !links.length) return entity;
  const ids = new Map([...traitsOf(entity), ...groupsOf(entity), ...links].map((item) => [item.id, randomUUID()] as const));
  const remap = (id: string | null | undefined) => (id ? ids.get(id) ?? id : id);
  const remapRequirement = (r: TraitRequirement): TraitRequirement =>
    ({ ...r, id: (r.kind === 'playingAs' ? entityIds.get(r.id) : ids.get(r.id)) ?? r.id });
  const reminted = withOwnedTraits(
    entity,
    traitsOf(entity).map((t) => ({
      ...t,
      id: remap(t.id)!,
      groupId: remap(t.groupId),
      ...(t.requires ? { requires: t.requires.map(remapRequirement) } : {}),
    })),
    groupsOf(entity).map((g) => ({ ...g, id: remap(g.id)!, parentId: remap(g.parentId) ?? null })),
  );
  // A link's original is a world node, so only the link's own id and its place inside the entity change.
  return links.length
    ? { ...reminted, traitLinks: links.map((l) => ({ ...l, id: remap(l.id)!, groupId: remap(l.groupId) ?? null })) }
    : reminted;
}

/** Every owner's traits for the gate module: the world first, then each entity that owns a trait or a group,
 *  then the library entities, whose nodes sit at the top level. The world owner leaves out Blueprints unless
 *  `keepBlueprints`, which the editor sets so its rows still read their gates. */
export function traitOwners(
  world: { traits: readonly Trait[]; traitGroups: readonly TraitGroup[]; entities: readonly Entity[] },
  library: readonly Entity[] = [],
  { keepBlueprints = false } = {},
): GateOwner[] {
  const placeable = placeableGroupIds(world.traitGroups);
  const owner = (e: Entity, parentGroupId: string | null): GateOwner =>
    ({ id: e.id, name: e.name, traits: traitsOf(e), groups: groupsOf(e), parentGroupId });
  const offered = keepBlueprints ? { traits: world.traits, groups: world.traitGroups } : offeredWorldTraits(world.traits, world.traitGroups);
  return [
    { id: WORLD_OWNER, name: '', ...offered },
    ...world.entities.filter(ownsTraits).map((e) => owner(e, effectivePlacement(e, placeable)?.groupId ?? null)),
    ...library.filter(ownsTraits).map((e) => owner(e, null)),
  ];
}

