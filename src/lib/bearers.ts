// Bearers: who has which traits. A bearer is the player or an entity whose tree holds a trait, directly or
// through a link. This module is the one place that expands a link to its original's live subtree.

import type { CustomPersonaNode, Entity, PersonaRef, Trait, TraitGroup, TraitLink, TraitPlacement } from '@/types';
import { WORLD_OWNER, type GateInput, type GateOwner } from './traitGates';
import { effectivePlacement, groupsBelow, offeredWorldTraits, ownsTraits, placeableGroupIds } from './traitTree';

/** The player bearer's id: the world's root traits, plus Custom Persona's links when they apply. It is the
 *  player's world key, so None and a library persona share the same state. */
export const PLAYER_BEARER = WORLD_OWNER;

/** What bearer resolution reads from a world. */
export interface BearerWorld {
  traits: readonly Trait[];
  traitGroups: readonly TraitGroup[];
  entities: readonly Entity[];
  customPersona?: CustomPersonaNode;
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

/** Whether a world entity is in the cast: not the played persona, and not a persona-only entity left
 *  unpicked. The persona-only flag reads only with the Persona mark. */
export function inCast(entity: Entity, persona: PersonaRef | undefined): boolean {
  if (persona?.source === 'world' && persona.entityId === entity.id) return false;
  return !(entity.persona && entity.personaOnly);
}

/** A world trait or group a link may point at. Templates itself and every owned item are not originals. */
export function originalOf(
  world: Pick<BearerWorld, 'traits' | 'traitGroups'>, id: string,
): { kind: 'trait'; item: Trait } | { kind: 'group'; item: TraitGroup } | null {
  const trait = world.traits.find((t) => t.id === id);
  if (trait) return { kind: 'trait', item: trait };
  const group = world.traitGroups.find((g) => g.id === id);
  return group && group.system !== 'templates' ? { kind: 'group', item: group } : null;
}

/** A link to `originalId` at `place`, or null when the id is not an original. */
export function makeLink(world: Pick<BearerWorld, 'traits' | 'traitGroups'>, originalId: string, id: string, place: TraitPlacement): TraitLink | null {
  const original = originalOf(world, originalId);
  return original && { id, originalId, kind: original.kind, originalName: original.item.name, ...place };
}

/** A world group's live subtree: the groups below it and every world trait in it or below it. Entity nodes
 *  are not world groups, so they never appear. */
function subtreeOf(world: BearerWorld, group: TraitGroup): { groups: TraitGroup[]; traits: Trait[] } {
  const groups = groupsBelow(world.traitGroups, group.id);
  const ids = new Set([group.id, ...groups.map((g) => g.id)]);
  return { groups, traits: world.traits.filter((t) => t.groupId != null && ids.has(t.groupId)) };
}

/** The world node ids a link to `originalId` brings: the original and, for a group, its live subtree. */
function broughtIds(world: BearerWorld, originalId: string): string[] {
  const original = originalOf(world, originalId);
  if (!original) return [];
  if (original.kind === 'trait') return [originalId];
  const { groups, traits } = subtreeOf(world, original.item);
  return [originalId, ...groups.map((g) => g.id), ...traits.map((t) => t.id)];
}

/** The trait with the link's own default-on when the link stores one; otherwise the original's, live. */
const withLinkDefault = (trait: Trait, link: TraitLink): Trait => {
  const on = link.defaults?.[trait.id];
  return on === undefined ? trait : { ...trait, isDefault: on };
};

/** Each link's expansion: the original moved to the link's place, with its subtree, or nothing. */
function expandLinks(world: BearerWorld, links: readonly TraitLink[], place?: (link: TraitLink) => TraitPlacement) {
  const traits: Trait[] = [];
  const groups: TraitGroup[] = [];
  const linkOf = new Map<string, TraitLink>();
  for (const link of links) {
    const original = originalOf(world, link.originalId);
    if (!original) continue;
    const at = place ? place(link) : { groupId: link.groupId, order: link.order ?? 0 };
    if (original.kind === 'trait') {
      traits.push(withLinkDefault({ ...original.item, ...at }, link));
      linkOf.set(original.item.id, link);
      continue;
    }
    const subtree = subtreeOf(world, original.item);
    groups.push({ ...original.item, parentId: at.groupId, order: at.order }, ...subtree.groups);
    traits.push(...subtree.traits.map((t) => withLinkDefault(t, link)));
    for (const item of [original.item, ...subtree.groups, ...subtree.traits]) linkOf.set(item.id, link);
  }
  return { traits, groups, linkOf };
}

/** An entity's bearer tree: its owned items with its links expanded among them. */
function entityBearer(world: BearerWorld, entity: Entity, isPlayer: boolean, present: boolean): Bearer {
  const expanded = expandLinks(world, entity.traitLinks ?? []);
  return {
    id: entity.id, name: entity.name, entity, isPlayer, present,
    traits: [...(entity.traits ?? []), ...expanded.traits],
    groups: [...(entity.traitGroups ?? []), ...expanded.groups],
    linkOf: expanded.linkOf,
  };
}

/** Custom Persona's links expanded at the player's root, after every root item. */
function customPersonaExpansion(world: BearerWorld, root: ReturnType<typeof offeredWorldTraits>) {
  const links = world.customPersona?.traitLinks ?? [];
  const rootOrders = [...root.groups.filter((g) => g.parentId === null), ...root.traits.filter((t) => (t.groupId ?? null) === null)]
    .map((item, i) => item.order ?? i);
  const afterRoot = Math.max(-1, ...rootOrders) + 1;
  return expandLinks(world, links, (link) => ({ groupId: null, order: afterRoot + (link.order ?? links.indexOf(link)) }));
}

/** The player bearer: the root outside Templates, plus Custom Persona's links under None or a library persona. */
function playerBearer(world: BearerWorld, persona: PersonaRef | undefined): Bearer {
  const root = offeredWorldTraits(world.traits, world.traitGroups);
  const expanded = persona?.source === 'world' ? expandLinks(world, []) : customPersonaExpansion(world, root);
  return {
    id: PLAYER_BEARER, name: '', entity: null, isPlayer: true, present: true,
    traits: [...root.traits, ...expanded.traits],
    groups: [...root.groups, ...expanded.groups],
    linkOf: expanded.linkOf,
  };
}

const gateOwner = (b: Bearer, parentGroupId: string | null): GateOwner =>
  ({ id: b.id, name: b.name, traits: b.traits, groups: b.groups, ...(b.entity ? { parentGroupId } : {}) });

/**
 * Every bearer's effective tree for one persona, the cast, and the gate input over the present bearers.
 * `library` holds the library entities the playthrough carries, the persona among them, with their
 * requirements already bound to the world.
 */
export function resolveBearers(
  world: BearerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = [],
): BearerResolution {
  const played = playedId(persona);
  const placeable = placeableGroupIds(world.traitGroups);
  const worldBearers = world.entities.filter(bearsTraits).map((e) =>
    entityBearer(world, e, e.id === played, e.id === played || inCast(e, persona)));
  const libraryBearers = library.filter(bearsTraits).map((e) => entityBearer(world, e, e.id === played, true));
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
 * The gate input the editor reads: the whole world as the player's owner, Templates included so every row
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
 * bearer holds every root item outside Templates and every Custom Persona link, whatever the persona the
 * bearer was resolved under, so Custom Persona cannot link what the root already offers and the check reads
 * the same in the editor and in play.
 */
export function holdsOriginal(world: BearerWorld, bearer: Bearer, originalId: string): boolean {
  const held = new Set(bearer.linkOf.keys());
  if (bearer.entity === null) {
    const root = offeredWorldTraits(world.traits, world.traitGroups);
    for (const item of [...root.traits, ...root.groups]) held.add(item.id);
    for (const id of customPersonaExpansion(world, root).linkOf.keys()) held.add(id);
  }
  return broughtIds(world, originalId).some((id) => held.has(id));
}
