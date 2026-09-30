// Bearers: who has which traits. A bearer is the player or an entity whose tree holds a trait, directly or
// through a link. This module is the one place that expands a link to its original's live subtree.

import type { Entity, PersonaRef, Trait, TraitGroup, TraitLink, TraitPlacement } from '@/types';
import { WORLD_OWNER, type GateInput, type GateOwner } from './traitGates';
import { effectivePlacement, groupsBelow, offeredWorldTraits, ownsTraits, placeableGroupIds } from './traitTree';
import { buildTree, flattenTree } from './groupTree';
import { effectiveLinkTrait } from './blueprints';

/** The player bearer's id: the world's root traits. It is the player's world key, so None and a library
 *  persona share the same state. */
export const PLAYER_BEARER = WORLD_OWNER;

/** What bearer resolution reads from a world. */
export interface BearerWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
}

/** One bearer's effective tree: its owned items plus each link's original and live subtree, in the places the
 *  bearer's tree gives them. Ids are the originals' own, so active state can hold them. */
export interface Bearer {
  /** {@link PLAYER_BEARER}, or the entity's id. */
  id: string;
  /** The entity's name; empty for the player bearer. */
  name: string;
  /** Null for the player bearer. */
  entity: Entity | null;
  traits: Trait[];
  groups: TraitGroup[];
  /** Effective trait or group id → the link that brought it. Owned items are absent. */
  linkOf: ReadonlyMap<string, TraitLink>;
  /** Whether this bearer's traits are the player's: the player bearer and the picked persona. */
  isPlayer: boolean;
  /** Whether the bearer is in this playthrough. False only for an unpicked persona-only entity. */
  present: boolean;
}

export interface BearerResolution {
  /** Every bearer, the player first, then the world's entities in order, then the library's. */
  bearers: Bearer[];
  /** The bearers whose active traits are "You". */
  playerBearerIds: string[];
  /** The world's entities without the played one and without unpicked persona-only entities. */
  cast: Entity[];
  /** The gate module's input over the present bearers, without the active sets. */
  gate: Omit<GateInput, 'active'>;
}

/** Whether the entity owns a trait or a group, or links to one. Any of these gives it a node in the tree. */
export const bearsTraits = (entity: Entity): boolean => ownsTraits(entity) || (entity.traitLinks?.length ?? 0) > 0;

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
  world: Pick<BearerWorld, 'traits' | 'traitGroups'>, id: string,
): { kind: 'trait'; item: Trait } | { kind: 'group'; item: TraitGroup } | null {
  const trait = world.traits.find((t) => t.id === id);
  if (trait) return { kind: 'trait', item: trait };
  const group = world.traitGroups.find((g) => g.id === id);
  return group && group.system !== 'blueprints' ? { kind: 'group', item: group } : null;
}

/** A link to `originalId` at `place`, reading the original live, or null when the id is not an original. */
export function makeLink(
  world: Pick<BearerWorld, 'traits' | 'traitGroups'>, originalId: string, id: string, place: TraitPlacement,
): TraitLink | null {
  const original = originalOf(world, originalId);
  if (!original) return null;
  return { id, originalId, kind: original.kind, originalName: original.item.name, ...place };
}

/** A world group's live subtree: the groups below it and every world trait in it or below it. Entity nodes
 *  are not world groups, so they never appear. */
function subtreeOf(world: Pick<BearerWorld, 'traits' | 'traitGroups'>, group: TraitGroup): { groups: TraitGroup[]; traits: Trait[] } {
  const groups = groupsBelow(world.traitGroups, group.id);
  const ids = new Set([group.id, ...groups.map((g) => g.id)]);
  return { groups, traits: world.traits.filter((t) => t.groupId != null && ids.has(t.groupId)) };
}

/** The world node ids a link to `originalId` brings: the original and, for a group, its live subtree. */
export function broughtIds(world: Pick<BearerWorld, 'traits' | 'traitGroups'>, originalId: string): string[] {
  const original = originalOf(world, originalId);
  if (!original) return [];
  if (original.kind === 'trait') return [originalId];
  const { groups, traits } = subtreeOf(world, original.item);
  return [originalId, ...groups.map((g) => g.id), ...traits.map((t) => t.id)];
}

/** Each link's expansion: the original moved to the link's place, with its subtree and the link's overrides
 *  on each trait, or nothing. Links run in `links` order, and an item `held` or brought by an earlier link
 *  is skipped, so each original expands once per bearer. */
function expandLinks(world: BearerWorld, links: readonly TraitLink[]) {
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
export function linksInTreeOrder(entity: Entity, links: readonly TraitLink[] = entity.traitLinks ?? []): TraitLink[] {
  const byId = new Map(links.map((l) => [l.id, l]));
  const leaves = links.map((l) => ({ id: l.id, name: '', groupId: l.groupId, order: l.order }));
  return flattenTree(buildTree(entity.traitGroups ?? [], leaves)).flatMap((row) => byId.get(row.id) ?? []);
}

/** The ids the player already holds before a played entity's own tree: every root trait and group outside
 *  Blueprints. */
function playerHeldIds(world: BearerWorld): Set<string> {
  const root = offeredWorldTraits(world.traits, world.traitGroups);
  return new Set([...root.traits, ...root.groups].map((item) => item.id));
}

/** An entity's bearer tree: its owned items with its links expanded among them. While the entity's traits
 *  are the player's, a link that brings anything the player already holds is dropped: the player holds it
 *  once, and the player's own row wins. The Custom Persona entity's tree is the player's under a library
 *  persona, so a trait gated only on that persona falls away there as it does at the root (see
 *  {@link withoutSelfNamedGates}); a played entity's own tree keeps its self-named gates. */
function entityBearer(world: BearerWorld, entity: Entity, persona: PersonaRef | undefined, isPlayer: boolean, present: boolean): Bearer {
  const held = isPlayer ? playerHeldIds(world) : null;
  const links = (entity.traitLinks ?? []).filter((l) => !held || !broughtIds(world, l.originalId).some((id) => held.has(id)));
  const expanded = expandLinks(world, linksInTreeOrder(entity, links));
  const traits = [...(entity.traits ?? []), ...expanded.traits];
  return {
    id: entity.id, name: entity.name, entity, isPlayer, present,
    traits: isPlayer && entity.customPersona ? withoutSelfNamedGates(traits, playedId(persona)) : traits,
    groups: [...(entity.traitGroups ?? []), ...expanded.groups],
    linkOf: expanded.linkOf,
  };
}

/**
 * The player's traits without the ones that name the played persona as another bearer. A named-scope
 * requirement describes a relationship to someone else, so while the player is that someone the requirement
 * falls away, and a trait that had no other way in is not offered.
 */
export function withoutSelfNamedGates(traits: readonly Trait[], playedId: string | null): Trait[] {
  if (playedId === null) return [...traits];
  return traits.flatMap((trait) => {
    const requires = trait.requires ?? [];
    if (requires.length === 0) return [trait];
    const kept = requires.filter((req) => !(req.kind !== 'playingAs' && req.bearer?.kind === 'entity' && req.bearer.id === playedId));
    if (kept.length === 0) return [];
    return [kept.length === requires.length ? trait : { ...trait, requires: kept }];
  });
}

/** The player bearer: the root outside Blueprints. A trait gated only on the played persona itself is left
 *  out (see {@link withoutSelfNamedGates}). The Custom Persona entity's tree is its own bearer. */
function playerBearer(world: BearerWorld, persona: PersonaRef | undefined): Bearer {
  const root = offeredWorldTraits(world.traits, world.traitGroups);
  return {
    id: PLAYER_BEARER, name: '', entity: null, isPlayer: true, present: true,
    traits: withoutSelfNamedGates(root.traits, playedId(persona)),
    groups: [...root.groups],
    linkOf: new Map(),
  };
}

const gateOwner = (b: Bearer, parentGroupId: string | null): GateOwner =>
  ({ id: b.id, name: b.name, traits: b.traits, groups: b.groups, ...(b.entity ? { parentGroupId } : {}) });

/**
 * Every bearer's effective tree for one persona, the cast, and the gate input over the present bearers.
 * `library` holds the library entities the playthrough carries, the persona among them, with their
 * requirements already bound to the world. The Custom Persona entity is a player bearer under None and a
 * library persona, and absent under a world persona.
 */
export function resolveBearers(
  world: BearerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = [],
): BearerResolution {
  const played = playedId(persona);
  const placeable = placeableGroupIds(world.traitGroups);
  // The Custom Persona entity is a bearer even while empty, so a link to it is checked against the root.
  const worldBearers = world.entities.filter((e) => bearsTraits(e) || e.customPersona).map((e) => {
    const isPlayer = playsAs(e, persona);
    return entityBearer(world, e, persona, isPlayer, isPlayer || inCast(e, persona));
  });
  const libraryBearers = library.filter(bearsTraits).map((e) => entityBearer(world, e, persona, e.id === played, true));
  const bearers = [playerBearer(world, persona), ...worldBearers, ...libraryBearers];
  const placementOf = new Map(world.entities.map((e) => [e.id, effectivePlacement(e, placeable)?.groupId ?? null]));
  return {
    bearers,
    playerBearerIds: bearers.filter((b) => b.isPlayer).map((b) => b.id),
    cast: world.entities.filter((e) => inCast(e, persona)),
    gate: {
      owners: bearers.filter((b) => b.present).map((b) => gateOwner(b, placementOf.get(b.id) ?? null)),
      entities: world.entities,
      persona: persona ?? { source: 'none' },
      originals: { traits: world.traits, groups: world.traitGroups },
    },
  };
}

/**
 * The gate input the editor reads: the whole world as the player's owner, Blueprints included so every row
 * reads its gate, then each entity bearer with its links expanded, a persona-only one included since the
 * author sees every tree. Nothing is active and there is no persona.
 */
export function editorGateInput(world: BearerWorld): GateInput {
  const { bearers, gate } = resolveBearers(world, undefined);
  const placeable = placeableGroupIds(world.traitGroups);
  return {
    ...gate,
    owners: [
      { id: PLAYER_BEARER, name: '', traits: world.traits, groups: world.traitGroups },
      ...bearers.filter((b) => b.entity).map((b) => gateOwner(b, effectivePlacement(b.entity!, placeable)?.groupId ?? null)),
    ],
    active: {},
  };
}

/**
 * Whether the bearer's tree already holds `originalId`, or anything a link to it would bring. The player
 * bearer and the Custom Persona entity hold every root item outside Blueprints, whatever the persona the
 * bearer was resolved under, so the check reads the same in the editor and in play.
 */
export function holdsOriginal(world: BearerWorld, bearer: Bearer, originalId: string): boolean {
  const held = new Set(bearer.linkOf.keys());
  if (bearer.entity === null || bearer.entity.customPersona) for (const id of playerHeldIds(world)) held.add(id);
  return broughtIds(world, originalId).some((id) => held.has(id));
}
