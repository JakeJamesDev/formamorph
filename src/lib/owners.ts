// Owners: who has which traits. Global scope holds the root traits no one owns; an owner is an entity whose
// tree holds a trait, directly or through a link. This module is the one place that expands a link to its original's live subtree.

import type { Entity, PersonaRef, Trait, TraitGroup, TraitLink, TreePlacement, TraitRequirement } from '@/types';
import { NO_ACTIVE, type GateInput, type GateOwner, type GateTree } from './traitGates';
import { groupsBelow, offeredWorldTraits, ownsTraits } from './traitTree';
import { nodePlacement, ownerLinksInTreeOrder, placeableGroupIds } from './ownerTree';
import { effectiveLinkTrait } from './blueprints';
import type { HeldReason } from './heldReasons';

/** What owner resolution reads from a world. */
export interface OwnerWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
}

/** One owner's effective tree: its own items plus each link's original and live subtree, in the places the
 *  owner's tree gives them. Ids are the originals' own, so active state can hold them. */
export interface Owner {
  /** The entity's id. */
  id: string;
  name: string;
  entity: Entity;
  traits: Trait[];
  groups: TraitGroup[];
  /** Effective trait or group id → the link that brought it. Own items are absent. */
  linkOf: ReadonlyMap<string, TraitLink>;
  /** Whether the owner is played: the picked persona, or the Custom Persona entity under None and a library
   *  persona. */
  isPlayer: boolean;
  /** Whether the owner is in this playthrough. False only for an unpicked persona-only entity. */
  present: boolean;
}

export interface OwnerResolution {
  /** Global scope's tree: the root outside Blueprints. */
  global: GlobalTree;
  /** Every entity owner, the world's entities in order, then the library's. */
  owners: Owner[];
  /** The played owners' ids, whose active traits are "You". */
  playedIds: string[];
  /** The world's entities without the played one and without unpicked persona-only entities. */
  cast: Entity[];
  /** The gate module's input over the present owners, without the active sets. */
  gate: Omit<GateInput, 'active'>;
}

/** Whether the entity owns a trait or a group, or links to one. Any of these gives it a node in the tree. */
export const ownsOrLinksTraits = (entity: Entity): boolean => ownsTraits(entity) || (entity.traitLinks?.length ?? 0) > 0;

const playedId = (persona: PersonaRef | undefined): string | null =>
  (persona && persona.source !== 'none' ? persona.entityId : null);

/** Whether a world entity is in the cast: not the played persona, not the Custom Persona entity, and not a
 *  persona-only entity left unpicked. The persona-only flag reads only with the Persona mark. */
export function inCast(entity: Entity, persona: PersonaRef | undefined): boolean {
  if (persona?.source === 'world' && persona.entityId === entity.id) return false;
  if (entity.customPersona) return false;
  return !(entity.persona && entity.personaOnly);
}

/** Whether the entity's traits are the player's under `persona`: the played world persona, or the Custom
 *  Persona entity under None and under a library persona. */
export const playsAs = (entity: Entity, persona: PersonaRef | undefined): boolean =>
  (persona?.source === 'world' ? persona.entityId === entity.id : !!entity.customPersona);

/** Whether the entity's traits can be the player's under some persona choice: a Persona, or the Custom
 *  Persona entity. What the editor, which has no persona, reads. */
export const canBePlayer = (entity: Pick<Entity, 'persona' | 'customPersona'>): boolean => !!entity.persona || !!entity.customPersona;

/** A world trait or group a link may point at. Blueprints itself and every owned item are not originals. */
export function originalOf(
  world: Pick<OwnerWorld, 'traits' | 'traitGroups'>, id: string,
): { kind: 'trait'; item: Trait } | { kind: 'group'; item: TraitGroup } | null {
  const trait = world.traits.find((t) => t.id === id);
  if (trait) return { kind: 'trait', item: trait };
  const group = world.traitGroups.find((g) => g.id === id);
  return group && group.system !== 'blueprints' ? { kind: 'group', item: group } : null;
}

/** A link to `originalId` at `place`, reading the original live, or null when the id is not an original. */
export function makeLink(
  world: Pick<OwnerWorld, 'traits' | 'traitGroups'>, originalId: string, id: string, place: TreePlacement,
): TraitLink | null {
  const original = originalOf(world, originalId);
  if (!original) return null;
  return { id, originalId, kind: original.kind, originalName: original.item.name, ...place };
}

/** A world group's live subtree: the groups below it and every world trait in it or below it. Entity nodes
 *  are not world groups, so they never appear. */
function subtreeOf(world: Pick<OwnerWorld, 'traits' | 'traitGroups'>, group: TraitGroup): { groups: TraitGroup[]; traits: Trait[] } {
  const groups = groupsBelow(world.traitGroups, group.id);
  const ids = new Set([group.id, ...groups.map((g) => g.id)]);
  return { groups, traits: world.traits.filter((t) => t.groupId != null && ids.has(t.groupId)) };
}

/** The world node ids a link to `originalId` brings: the original and, for a group, its live subtree. */
export function broughtIds(world: Pick<OwnerWorld, 'traits' | 'traitGroups'>, originalId: string): string[] {
  const original = originalOf(world, originalId);
  if (!original) return [];
  if (original.kind === 'trait') return [originalId];
  const { groups, traits } = subtreeOf(world, original.item);
  return [originalId, ...groups.map((g) => g.id), ...traits.map((t) => t.id)];
}

/** Each link's expansion: the original moved to the link's place, with its subtree and the link's overrides
 *  on each trait, or nothing. Links run in `links` order, and an item `held` or brought by an earlier link
 *  is skipped, so each original expands once per owner. */
function expandLinks(world: OwnerWorld, links: readonly TraitLink[]) {
  const traits: Trait[] = [];
  const groups: TraitGroup[] = [];
  const linkOf = new Map<string, TraitLink>();
  const brought = new Set<string>();
  for (const link of links) {
    const original = originalOf(world, link.originalId);
    if (!original || brought.has(original.item.id)) continue;
    const at = { groupId: link.groupId, order: link.order ?? 0 };
    if (original.kind === 'trait') {
      traits.push(effectiveLinkTrait({ ...original.item, ...at }, link));
      linkOf.set(original.item.id, link);
      brought.add(original.item.id);
      continue;
    }
    const subtree = subtreeOf(world, original.item);
    // A subgroup already brought took its own subtree with it, so filtering by id keeps the rest in place.
    const subGroups = subtree.groups.filter((g) => !brought.has(g.id));
    const subTraits = subtree.traits.filter((t) => !brought.has(t.id));
    groups.push({ ...original.item, parentId: at.groupId, order: at.order }, ...subGroups);
    traits.push(...subTraits.map((t) => effectiveLinkTrait(t, link)));
    for (const item of [original.item, ...subGroups, ...subTraits]) {
      linkOf.set(item.id, link);
      brought.add(item.id);
    }
  }
  return { traits, groups, linkOf };
}

/** An entity's links in its tree's order: by place among its own groups, then by order. */
export const linksInTreeOrder = (entity: Entity, links: readonly TraitLink[] = entity.traitLinks ?? []): TraitLink[] =>
  ownerLinksInTreeOrder(entity.traitGroups ?? [], links);

/** An entity's owner tree: its own items with its links expanded among them. A link to a root item the root
 *  also holds stays: each holds it apart (Q17). The Custom Persona entity's tree is the player's under a
 *  library persona, so a trait gated only on that persona falls away there as it does at the root (see
 *  {@link withoutSelfNamedGates}); a played entity's own tree keeps its self-named gates. */
function entityOwner(world: OwnerWorld, entity: Entity, persona: PersonaRef | undefined, isPlayer: boolean, present: boolean): Owner {
  const expanded = expandLinks(world, linksInTreeOrder(entity));
  const traits = [...(entity.traits ?? []), ...expanded.traits];
  return {
    id: entity.id, name: entity.name, entity, isPlayer, present,
    traits: isPlayer && entity.customPersona ? withoutSelfNamedGates(traits, playedId(persona)) : traits,
    groups: [...(entity.traitGroups ?? []), ...expanded.groups],
    linkOf: expanded.linkOf,
  };
}

/**
 * The player's traits without the gates that name the played persona as another owner. A named-scope
 * Condition describes a relationship to someone else, so while the player is that someone it can never
 * hold: its row falls away, and a trait that had no other row is not offered (Q23).
 */
export function withoutSelfNamedGates(traits: readonly Trait[], playedId: string | null): Trait[] {
  if (playedId === null) return [...traits];
  const selfNamed = (req: TraitRequirement) => req.kind !== 'playingAs' && req.owner?.kind === 'entity' && req.owner.id === playedId;
  return traits.flatMap((trait) => {
    const rows = trait.requires ?? [];
    if (rows.length === 0) return [trait];
    const kept = rows.filter((row) => !row.all.some(selfNamed));
    if (kept.length === 0) return [];
    return [kept.length === rows.length ? trait : { ...trait, requires: kept }];
  });
}

/** Global scope's tree as play reads it. */
export interface GlobalTree {
  traits: Trait[];
  groups: TraitGroup[];
}

/** Global scope's tree: the root outside Blueprints. A trait gated only on the played persona itself is left
 *  out (see {@link withoutSelfNamedGates}). The Custom Persona entity's tree is its own owner. */
function globalTree(world: OwnerWorld, persona: PersonaRef | undefined): GlobalTree {
  const root = offeredWorldTraits(world.traits, world.traitGroups);
  return { traits: withoutSelfNamedGates(root.traits, playedId(persona)), groups: [...root.groups] };
}

const gateOwner = (b: Owner, parentGroupId: string | null): GateOwner =>
  ({ id: b.id, name: b.name, traits: b.traits, groups: b.groups, parentGroupId });

/**
 * Every owner's effective tree for one persona, the cast, and the gate input over the present owners.
 * `library` holds the library entities the playthrough carries, the persona among them, with their
 * requirements already bound to the world. The Custom Persona entity is a played owner under None and a
 * library persona, and absent under a world persona.
 */
export function resolveOwners(
  world: OwnerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = [],
): OwnerResolution {
  const played = playedId(persona);
  const placeable = placeableGroupIds(world.traitGroups);
  // The Custom Persona entity is an owner even while empty, so a link to it is checked against the root.
  const worldOwners = world.entities.filter((e) => ownsOrLinksTraits(e) || e.customPersona).map((e) => {
    const isPlayer = playsAs(e, persona);
    return entityOwner(world, e, persona, isPlayer, isPlayer || inCast(e, persona));
  });
  const libraryOwners = library.filter(ownsOrLinksTraits).map((e) => entityOwner(world, e, persona, e.id === played, true));
  const owners = [...worldOwners, ...libraryOwners];
  const global = globalTree(world, persona);
  const placementOf = new Map(world.entities.map((e) => [e.id, nodePlacement(e.traitPlacement, e, placeable)?.groupId ?? null]));
  return {
    global,
    owners,
    playedIds: owners.filter((o) => o.isPlayer).map((o) => o.id),
    cast: world.entities.filter((e) => inCast(e, persona)),
    gate: {
      global,
      owners: owners.filter((o) => o.present).map((o) => gateOwner(o, placementOf.get(o.id) ?? null)),
      entities: world.entities,
      persona: persona ?? { source: 'none' },
      originals: { traits: world.traits, groups: world.traitGroups },
    },
  };
}

/**
 * The gate input the editor reads: the whole world as global scope's tree, Blueprints included so every row
 * reads its gate, then each entity owner with its links expanded, a persona-only one included since the
 * author sees every tree. Nothing is active and there is no persona. `stats` are what a stat Condition reads.
 */
export function editorGateInput(world: OwnerWorld, stats?: GateInput['stats']): GateInput {
  const { owners, gate } = resolveOwners(world, undefined);
  const placeable = placeableGroupIds(world.traitGroups);
  const whole: GateTree = { traits: world.traits, groups: world.traitGroups };
  return {
    ...gate,
    global: whole,
    owners: owners.map((o) => gateOwner(o, nodePlacement(o.entity.traitPlacement, o.entity, placeable)?.groupId ?? null)),
    active: NO_ACTIVE,
    ...(stats ? { stats } : {}),
  };
}

/** Why the owner's tree already holds `originalId`, or anything a link to it would bring; null when it holds
 *  none of it. */
export function heldReason(world: OwnerWorld, owner: Owner, originalId: string): HeldReason | null {
  const name = originalOf(world, originalId)?.item.name ?? '';
  const brought = broughtIds(world, originalId);
  const direct = owner.linkOf.get(originalId);
  if (direct) {
    return direct.originalId === originalId
      ? { kind: 'links', name: name || direct.originalName }
      : { kind: 'group', name, group: direct.originalName };
  }
  const inside = brought.map((id) => owner.linkOf.get(id)).find((link) => link);
  return inside ? { kind: 'inside', name: inside.originalName, group: name } : null;
}

/** Whether the owner's tree already holds `originalId`, or anything a link to it would bring. */
export const holdsOriginal = (world: OwnerWorld, owner: Owner, originalId: string): boolean =>
  heldReason(world, owner, originalId) !== null;
