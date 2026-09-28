// Owned traits during play: which are active, and the pins each bearer's traits lay.

import type { DiscoveredEntity, Entity, OwnedTraitStates, PersonaRef, Placeholder, Trait, TraitGroup } from '@/types';
import { PLAYER_BEARER, resolveBearers, type Bearer, type BearerWorld } from './bearers';
import { bindBearerPins, collectPins, type PinSources } from './placeholderPins';
import { bindOwnedTraits, type TraitWorld } from './portableTraits';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';
import type { GateOwner } from './traitGates';
import { effectivePlacement, placeableGroupIds } from './traitTree';
import { mapPreservingIdentity } from './utils';

/** The entity whose owned traits are the player's own: the played persona's, or null. */
export const playedEntityId = (ref: PersonaRef | undefined): string | null =>
  (ref && ref.source !== 'none' ? ref.entityId : null);

/** Entity id → its active owned trait ids: the chosen ones less those switched off. */
export function activeOwnedTraitIds(states: Readonly<OwnedTraitStates>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(states).map(([id, s]) => {
    const off = new Set(s.disabled ?? []);
    return [id, s.chosen.filter((t) => !off.has(t))];
  }));
}


/** The characters added from the library at Enter World, among the discovered cast. */
export const addedCharacters = (discovered: readonly DiscoveredEntity[]): Entity[] =>
  discovered.filter((d) => d.sourceTurnId === INITIAL_SOURCE_TURN_ID).map((d) => d.entity);

/** The library entities a playthrough holds, whose nodes sit last in the one tree: the library persona, then
 *  the added characters, with their owned trait requirements bound to the world. */
export const inPlayLibrary = (
  world: TraitWorld, libraryPersona: Entity | null | undefined, added: readonly Entity[] = [],
): Entity[] => [...(libraryPersona ? [libraryPersona] : []), ...added].map((e) => bindOwnedTraits(e, world));

/** Every present bearer as the gate module reads it in play: the player, the world's entities, then the
 *  library's. */
export const inPlayBearers = (world: BearerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = []): readonly GateOwner[] =>
  resolveBearers(world, persona, library).gate.owners;

/** The player-facing Traits tree: the player bearer's rows at the top level, and a node for each present
 *  entity bearer with its tree below it. Trait ids are the originals', so active state reads them as they
 *  are; a trait under two bearers is two rows with one id, told apart by the bearer whose node holds it. */
export interface BearerTraitTree {
  groups: TraitGroup[];
  traits: Trait[];
  /** Entity node id → the entity it draws. */
  entityNodes: Map<string, Entity>;
  /** Group row id → the entity bearer whose tree holds it: the node itself and every group below it. The
   *  player bearer's groups are absent, so a trait row's bearer is its group's, else the player. */
  bearerOfGroup: Map<string, string>;
  bearers: Bearer[];
}

/** The row id of an entity bearer's group. Two bearers may link one group, so its id alone cannot be a row. */
export const bearerGroupId = (bearerId: string, groupId: string): string => `${bearerId}/${groupId}`;

/** Every present bearer's tree in one list, in the order Enter World and the Traits tab draw it: an entity
 *  node sits where its placement puts it; an unplaced node goes to the end of the top level, in entity
 *  order, and the library's nodes come last. */
export function bearerTraitTree(world: BearerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = []): BearerTraitTree {
  const { bearers } = resolveBearers(world, persona, library);
  const player = bearers.find((b) => b.id === PLAYER_BEARER)!;
  const nodes = bearers.filter((b) => b.entity && b.present);
  const placeable = placeableGroupIds(world.traitGroups);
  const libraryIds = new Set(library.map((e) => e.id));
  const placementOf = (b: Bearer) => (libraryIds.has(b.id) ? null : effectivePlacement(b.entity!, placeable));
  const rootGroupIds = new Set(player.groups.map((g) => g.id));
  const atRoot = (ref: string | null | undefined) => ref == null || !rootGroupIds.has(ref);
  const rootSorts = [
    ...player.groups.map((g, i) => (atRoot(g.parentId) ? g.order ?? i : -1)),
    ...player.traits.map((t, i) => (atRoot(t.groupId) ? t.order ?? i : -1)),
    ...nodes.map(placementOf).map((p) => (p?.groupId === null ? p.order : -1)),
  ];
  const firstNodeOrder = Math.max(-1, ...rootSorts) + 1;

  const groups = [...player.groups];
  const traits = [...player.traits];
  const entityNodes = new Map<string, Entity>();
  const bearerOfGroup = new Map<string, string>();
  let unplaced = 0;
  for (const bearer of nodes) {
    entityNodes.set(bearer.id, bearer.entity!);
    bearerOfGroup.set(bearer.id, bearer.id);
    const placement = placementOf(bearer);
    groups.push({
      id: bearer.id, name: bearer.name,
      parentId: placement?.groupId ?? null, order: placement ? placement.order : firstNodeOrder + unplaced++,
    });
    const ownIds = new Set(bearer.groups.map((g) => g.id));
    const parent = (ref: string | null | undefined) => (ref != null && ownIds.has(ref) ? bearerGroupId(bearer.id, ref) : bearer.id);
    for (const g of bearer.groups) {
      groups.push({ ...g, id: bearerGroupId(bearer.id, g.id), parentId: parent(g.parentId) });
      bearerOfGroup.set(bearerGroupId(bearer.id, g.id), bearer.id);
    }
    for (const t of bearer.traits) traits.push({ ...t, groupId: parent(t.groupId) });
  }
  return { groups, traits, entityNodes, bearerOfGroup, bearers };
}

/** The bearer a tree row belongs to: its group's entity bearer, else the player. */
export const rowBearer = (tree: Pick<BearerTraitTree, 'bearerOfGroup'>, row: Pick<Trait, 'groupId'>): string =>
  (row.groupId != null ? tree.bearerOfGroup.get(row.groupId) : undefined) ?? PLAYER_BEARER;

/** What every bearer's pins are read from in play. */
export interface BearerPinState {
  world: BearerWorld;
  persona: PersonaRef | undefined;
  /** The library entities the playthrough holds, the library persona among them. */
  library?: readonly Entity[];
  /** The player's chosen world traits as the save holds them: the root's and Custom Persona's originals. */
  playerTraits: readonly Trait[];
  /** The player's traits switched off. */
  disabledTraitIds?: readonly string[];
  /** Entity id → its active trait ids: owned ones, and originals it links. */
  owned: Readonly<Record<string, readonly string[]>>;
  /** The world's shared placeholders, which a bearer-relative pin falls back to by name. */
  sharedPlaceholders: readonly Placeholder[];
}

/** The pins in force per bearer. */
export interface PinSet {
  /** World-level text, and the played persona's own: the world pins plus the player's traits. */
  world: Record<string, string>;
  /** One bearer's own text. A cast entity's lays its traits over `world`; the played persona, null and the
   *  player bearer read `world`. */
  of: (bearerId: string | null | undefined) => Record<string, string>;
  /** The trait with its bearer-relative pins bound for that bearer, for its own card. */
  bind: (trait: Trait, bearerId: string | null | undefined) => Trait;
}

/**
 * The pins in force per bearer, with `sources` supplying the world pins. The player's traits lay first: the
 * world traits and the played entity's, together in one-tree order, then the played entity's links. A cast
 * entity's active traits lay after them in its own tree order, so it wins in its own text. Only the player's
 * traits switch stat bands.
 */
export function bearerPins(state: BearerPinState, sources: Omit<PinSources, 'traits' | 'disabledTraitIds' | 'statTraits'>): PinSet {
  const { world, persona, library = [], owned, sharedPlaceholders } = state;
  const { bearers } = resolveBearers(world, persona, library);
  const played = playedEntityId(persona);
  const playerBearer = bearers.find((b) => b.id === PLAYER_BEARER);
  const playedBearer = played ? bearers.find((b) => b.id === played) : undefined;
  const personaEntity = played ? [...world.entities, ...library].find((e) => e.id === played) : undefined;
  const isPlayer = (id: string | null | undefined) => !id || id === PLAYER_BEARER || id === played;

  const ownOf = (id: string | null | undefined) =>
    (isPlayer(id) ? personaEntity : bearers.find((b) => b.id === id)?.entity)?.placeholders ?? [];
  const linkOf = (trait: Trait, id: string | null | undefined) => (isPlayer(id)
    ? playerBearer?.linkOf.get(trait.id) ?? playedBearer?.linkOf.get(trait.id)
    : bearers.find((b) => b.id === id)?.linkOf.get(trait.id));
  const bind = (trait: Trait, id: string | null | undefined) =>
    bindBearerPins(trait, linkOf(trait, id), ownOf(id), sharedPlaceholders);
  const activeIn = (bearer: Bearer | undefined) => {
    const on = new Set(bearer ? owned[bearer.id] ?? [] : []);
    return bearer ? bearer.traits.filter((t) => on.has(t.id)) : [];
  };

  const off = new Set(state.disabledTraitIds ?? []);
  const tree = bearerTraitTree(world, persona, library);
  const playedOwned = activeIn(playedBearer);
  // A Custom Persona pick lies dormant under a world persona: it lays nothing until a return to None.
  const heldIds = new Set(playerBearer?.traits.map((t) => t.id));
  const playerTraits = [
    ...inAuthoredOrder([...state.playerTraits.filter((t) => heldIds.has(t.id)), ...playedOwned.filter((t) => !playedBearer?.linkOf.has(t.id))],
      traitOrderIndex(tree.traits, tree.groups)),
    ...(playedBearer ? inBearerOrder(playedOwned.filter((t) => playedBearer.linkOf.has(t.id)), playedBearer) : []),
  ].filter((t) => !off.has(t.id));
  const playerLaid = playerTraits.map((t) => bind(t, null));
  const collect = (traits: readonly Trait[]) => collectPins({ ...sources, traits, statTraits: playerTraits });

  const worldPins = collect(playerLaid);
  const cache = new Map<string, Record<string, string>>();
  const of = (id: string | null | undefined) => {
    if (isPlayer(id)) return worldPins;
    let pins = cache.get(id!);
    if (!pins) {
      const bearer = bearers.find((b) => b.id === id);
      const own = bearer ? inBearerOrder(activeIn(bearer), bearer).map((t) => bind(t, id)).filter((t) => t.placeholderPins?.length) : [];
      cache.set(id!, (pins = own.length ? collect([...playerLaid, ...own]) : worldPins));
    }
    return pins;
  };
  return { world: worldPins, of, bind };
}

const inBearerOrder = (traits: readonly Trait[], bearer: Bearer): Trait[] =>
  inAuthoredOrder(traits, traitOrderIndex(bearer.traits, bearer.groups));

/** One bearer's effective tree, as an entity's AI context reads it. */
export type BearerTree = Pick<GateOwner, 'id' | 'traits' | 'groups'>;

/** Each entity with its bearer tree as its traits and groups, so its links read like owned traits. An entity
 *  with no bearer, or with nothing linked, stays as it is. */
export function withBearerTrees(entities: readonly Entity[], trees: readonly BearerTree[] | undefined): Entity[] {
  const byId = new Map((trees ?? []).map((tree) => [tree.id, tree]));
  return mapPreservingIdentity(entities, (entity) => {
    const tree = byId.get(entity.id);
    const same = !tree || (tree.traits.length === (entity.traits?.length ?? 0) && tree.groups.length === (entity.traitGroups?.length ?? 0));
    return same ? entity : { ...entity, traits: [...tree.traits], traitGroups: [...tree.groups] };
  });
}

/** The traits where the bearer's tree places them, so a linked original sits at its link and never under
 *  Templates. A trait the tree lacks keeps its own place. */
export function inBearerPlaces(traits: readonly Trait[], tree: BearerTree | undefined): Trait[] {
  const placed = new Map((tree?.traits ?? []).map((t) => [t.id, t]));
  return mapPreservingIdentity(traits, (trait) => {
    const at = placed.get(trait.id);
    return !at || (at.groupId === trait.groupId && at.order === trait.order) ? trait : { ...trait, groupId: at.groupId, order: at.order };
  });
}

/** What roll priming walks per bearer, whoever ends up played. */
export interface BearerPriming {
  /** Every bearer's trait and group names and descriptions, owned ones included. */
  texts: string[];
  /** Every bearer's traits that pin, with bearer-relative pins bound for that bearer. The player's bind to the
   *  world's placeholders and to each library entity's. */
  pinTraits: Trait[];
}

export function bearerPriming(world: BearerWorld, library: readonly Entity[], shared: readonly Placeholder[]): BearerPriming {
  const { bearers } = resolveBearers(world, undefined, library);
  const texts = bearers.flatMap((bearer) => [...bearer.traits, ...bearer.groups]
    .flatMap((item) => [item.name, item.playerDescription, item.aiDescription])
    .filter((text): text is string => !!text));
  const pinTraits = bearers.flatMap((bearer) => {
    const owns = bearer.entity ? [bearer.entity.placeholders ?? []] : [[], ...library.map((e) => e.placeholders ?? [])];
    return owns.flatMap((own) => bearer.traits
      .filter((t) => t.placeholderPins?.length)
      .map((t) => bindBearerPins(t, bearer.linkOf.get(t.id), own, shared)));
  });
  return { texts, pinTraits };
}
