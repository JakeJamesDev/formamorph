// Bearers: who has which traits. A bearer is the player or an entity whose tree holds a trait, directly or
// through a link. This module expands every link to its original's live subtree and is the one place that
// does so; the editor tree, enter-world, play, the pin collector, the AI context and the Test Bench read
// bearer trees from here.

import type { CustomPersonaNode, Entity, PersonaRef, Trait, TraitGroup, TraitLink } from '@/types';
import { WORLD_OWNER, type GateInput, type GateOwner } from './traitGates';
import { effectivePlacement, ownsTraits, placeableGroupIds, templatesSubtreeIds } from './traitTree';

/** The player bearer's id: the world's root traits, plus Custom Persona's links when they apply. It is the
 *  player's world key, so None and a library persona share the same state. */
export const PLAYER_BEARER = WORLD_OWNER;

/** The Custom Persona node's id in the Traits tree. No world item takes it. */
export const CUSTOM_PERSONA_NODE = 'custom-persona';

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
  world: BearerWorld, id: string,
): { kind: 'trait'; item: Trait } | { kind: 'group'; item: TraitGroup } | null {
  const trait = world.traits.find((t) => t.id === id);
  if (trait) return { kind: 'trait', item: trait };
  const group = world.traitGroups.find((g) => g.id === id);
  return group && group.system !== 'templates' ? { kind: 'group', item: group } : null;
}

/** A link to `originalId` at `place`, or null when the id is not an original. */
export function makeLink(
  world: BearerWorld, originalId: string, id: string, place: { groupId: string | null; order: number },
): TraitLink | null {
  const original = originalOf(world, originalId);
  return original && { id, originalId, kind: original.kind, originalName: original.item.name, ...place };
}

/** Every world group below `groupId`, depth-first. Entity nodes are not world groups, so they never appear. */
function worldGroupsBelow(world: BearerWorld, groupId: string): TraitGroup[] {
  const out: TraitGroup[] = [];
  const walk = (parentId: string) => {
    for (const g of world.traitGroups) if (g.parentId === parentId) { out.push(g); walk(g.id); }
  };
  walk(groupId);
  return out;
}

/** The world node ids a link to `originalId` brings: the original and, for a group, its live subtree. */
function broughtIds(world: BearerWorld, originalId: string): string[] {
  const original = originalOf(world, originalId);
  if (!original) return [];
  if (original.kind === 'trait') return [originalId];
  const groupIds = [originalId, ...worldGroupsBelow(world, originalId).map((g) => g.id)];
  return [...groupIds, ...world.traits.filter((t) => t.groupId != null && groupIds.includes(t.groupId)).map((t) => t.id)];
}

const withDefault = (trait: Trait, link: TraitLink): Trait => {
  const on = link.defaults?.[trait.id];
  return on === undefined ? trait : { ...trait, isDefault: on };
};

/** Each link's expansion: the original moved to the link's place, with its subtree, or nothing. */
function expandLinks(world: BearerWorld, links: readonly TraitLink[], place?: (link: TraitLink) => { groupId: string | null; order: number }) {
  const traits: Trait[] = [];
  const groups: TraitGroup[] = [];
  const linkOf = new Map<string, TraitLink>();
  for (const link of links) {
    const original = originalOf(world, link.originalId);
    if (!original) continue;
    const at = place ? place(link) : { groupId: link.groupId, order: link.order };
    if (original.kind === 'trait') {
      traits.push(withDefault({ ...original.item, ...at }, link));
      linkOf.set(original.item.id, link);
      continue;
    }
    const group = original.item;
    groups.push({ ...group, parentId: at.groupId, order: at.order });
    linkOf.set(group.id, link);
    const below = worldGroupsBelow(world, group.id);
    for (const g of below) { groups.push(g); linkOf.set(g.id, link); }
    const groupIds = new Set([group.id, ...below.map((g) => g.id)]);
    for (const t of world.traits) {
      if (t.groupId != null && groupIds.has(t.groupId)) { traits.push(withDefault(t, link)); linkOf.set(t.id, link); }
    }
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

/** The player bearer: the root outside Templates, plus Custom Persona's links under None or a library
 *  persona. Those expand at the root, after every root item. */
function playerBearer(world: BearerWorld, persona: PersonaRef | undefined): Bearer {
  const inTemplates = templatesSubtreeIds(world.traitGroups);
  const groups = world.traitGroups.filter((g) => !inTemplates.has(g.id));
  const traits = world.traits.filter((t) => t.groupId == null || !inTemplates.has(t.groupId));
  const rootOrders = [...groups.filter((g) => g.parentId === null), ...traits.filter((t) => (t.groupId ?? null) === null)]
    .map((item, i) => item.order ?? i);
  const afterRoot = Math.max(-1, ...rootOrders) + 1;
  const links = persona?.source === 'world' ? [] : world.customPersona?.traitLinks ?? [];
  const expanded = expandLinks(world, links, (link) => ({ groupId: null, order: afterRoot + (link.order ?? links.indexOf(link)) }));
  return {
    id: PLAYER_BEARER, name: '', entity: null, isPlayer: true, present: true,
    traits: [...traits, ...expanded.traits],
    groups: [...groups, ...expanded.groups],
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
    },
  };
}

/** Whether the bearer's tree already holds `originalId`, or anything a link to it would bring. The player
 *  bearer holds every root item outside Templates, so Custom Persona cannot link what the root already offers. */
export function holdsOriginal(world: BearerWorld, bearer: Bearer, originalId: string): boolean {
  const held = new Set(bearer.linkOf.keys());
  if (bearer.entity === null) for (const item of [...bearer.traits, ...bearer.groups]) held.add(item.id);
  return broughtIds(world, originalId).some((id) => held.has(id));
}
