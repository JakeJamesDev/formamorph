// Owned traits during play: which are active, and the pins each bearer's traits lay.

import type { DiscoveredEntity, Entity, OwnedTraitStates, PersonaRef, Placeholder, Trait, TraitGroup } from '@/types';
import { PLAYER_BEARER, resolveBearers, type Bearer, type BearerWorld } from './bearers';
import { copyLookup, customPersonaEntity, readerFor, type CopyLookup, type CopyReader } from './blueprints';
import { characterAsPlayer } from './builtinPlaceholders';
import { entityTexts } from './entityTexts';
import { bindBlueprintPins, collectPins, type PinSources } from './placeholderPins';
import { bindOwnedTraits, type TraitWorld } from './portableTraits';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';
import { defaultPicks, exclusiveSiblings, inAuthoredOrder, traitOrderIndex } from './traitEffects';
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
 *  order, and the library's nodes come last. The picked persona takes the Custom Persona entity's slot,
 *  leaving its own placement; the marked entity's node, when present, follows it directly. */
export function bearerTraitTree(world: BearerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = []): BearerTraitTree {
  const { bearers } = resolveBearers(world, persona, library);
  const player = bearers.find((b) => b.id === PLAYER_BEARER)!;
  const played = playedEntityId(persona);
  const marked = customPersonaEntity(world.entities);
  // The entity whose place a node takes: the marked entity for the picked persona, else its own.
  const slotOf = (b: Bearer) => (marked && b.id === played ? marked : b.entity!);
  const rank = new Map(bearers.map((b, i) => [b.id, i]));
  // Two nodes in one slot: the picked persona comes first, the marked entity right after.
  const playedFirst = (a: Bearer, b: Bearer) => (a.id === played ? -1 : b.id === played ? 1 : 0);
  const nodes = bearers.filter((b) => b.entity && b.present)
    .sort((a, b) => (rank.get(slotOf(a).id)! - rank.get(slotOf(b).id)!) || playedFirst(a, b));
  const placeable = placeableGroupIds(world.traitGroups);
  const libraryIds = new Set(library.map((e) => e.id));
  const placementOf = (b: Bearer) => {
    const slot = slotOf(b);
    return libraryIds.has(slot.id) ? null : effectivePlacement(slot, placeable);
  };
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

/** The entity nodes that are the player's, in node order: the played persona, and the Custom Persona
 *  entity under None and a library persona. Each wears the You mark. */
export const playerEntityIds = (tree: Pick<BearerTraitTree, 'bearers'>): string[] =>
  tree.bearers.filter((b) => b.entity && b.isPlayer && b.present).map((b) => b.id);

/** The bearer a tree row belongs to: its group's entity bearer, else the player. */
export const rowBearer =(tree: Pick<BearerTraitTree, 'bearerOfGroup'>, row: Pick<Trait, 'groupId'>): string =>
  (row.groupId != null ? tree.bearerOfGroup.get(row.groupId) : undefined) ?? PLAYER_BEARER;

/** What every bearer's pins are read from in play. */
export interface BearerPinState {
  world: BearerWorld;
  persona: PersonaRef | undefined;
  /** The library entities the playthrough holds, the library persona among them. */
  library?: readonly Entity[];
  /** The player's chosen world traits as the save holds them: the root's originals. */
  playerTraits: readonly Trait[];
  /** The player's traits switched off. */
  disabledTraitIds?: readonly string[];
  /** Entity id → its active trait ids: owned ones, and originals it links. */
  owned: Readonly<Record<string, readonly string[]>>;
  /** The world's shared placeholders, the blueprints among them. */
  sharedPlaceholders: readonly Placeholder[];
}

/** The pins in force per bearer. */
export interface PinSet {
  /** World-level text, and the played persona's own: the world pins plus the player's traits. */
  world: Record<string, string>;
  /** One bearer's own text. A cast entity's lays its traits over `world`; the played persona, null and the
   *  player bearer read `world`. */
  of: (bearerId: string | null | undefined) => Record<string, string>;
  /** The trait with its blueprint pins traced to that bearer's copies, for its own card. */
  bind: (trait: Trait, bearerId: string | null | undefined) => Trait;
  /** The copy lookup a bearer's trait text resolves its blueprint chips through. */
  copies: (bearerId: string | null | undefined) => CopyLookup;
}

/**
 * The pins in force per bearer, with `sources` supplying the world pins. The player's traits lay first: the
 * world traits and each played entity's own, together in one-tree order, then the played entities' links. A
 * played entity is the world persona, or the Custom Persona entity and a library persona. A cast entity's
 * active traits lay after them in its own tree order, so it wins in its own text. Only the player's traits
 * switch stat bands.
 */
export function bearerPins(state: BearerPinState, sources: Omit<PinSources, 'traits' | 'disabledTraitIds' | 'statTraits'>): PinSet {
  const { world, persona, library = [], owned, sharedPlaceholders } = state;
  const { bearers } = resolveBearers(world, persona, library);
  const played = playedEntityId(persona);
  const playerBearer = bearers.find((b) => b.id === PLAYER_BEARER);
  const playedBearers = bearers.filter((b) => b.isPlayer && b.entity);
  const personaEntity = played ? [...world.entities, ...library].find((e) => e.id === played) ?? null : null;
  const isPlayer = (id: string | null | undefined) => !id || id === PLAYER_BEARER || playedBearers.some((b) => b.id === id);

  const blueprints = { placeholders: sharedPlaceholders, entities: world.entities };
  const readerOf = (id: string | null | undefined): CopyReader => (isPlayer(id)
    ? readerFor(persona, personaEntity, true)
    : readerFor(persona, bearers.find((b) => b.id === id)?.entity ?? null, false));
  const bind = (trait: Trait, id: string | null | undefined) => bindBlueprintPins(trait, blueprints, readerOf(id));
  const lookups = new Map<string, CopyLookup>();
  const copies = (id: string | null | undefined) => {
    const key = isPlayer(id) ? PLAYER_BEARER : id!;
    let lookup = lookups.get(key);
    if (!lookup) lookups.set(key, (lookup = copyLookup(blueprints, readerOf(id))));
    return lookup;
  };
  const activeIn = (bearer: Bearer | undefined) => {
    const on = new Set(bearer ? owned[bearer.id] ?? [] : []);
    return bearer ? bearer.traits.filter((t) => on.has(t.id)) : [];
  };

  const off = new Set(state.disabledTraitIds ?? []);
  const tree = bearerTraitTree(world, persona, library);
  const heldIds = new Set(playerBearer?.traits.map((t) => t.id));
  const playedOwned = playedBearers.flatMap((b) => activeIn(b).filter((t) => !b.linkOf.has(t.id)));
  const playerTraits = [
    ...inAuthoredOrder([...state.playerTraits.filter((t) => heldIds.has(t.id)), ...playedOwned], traitOrderIndex(tree.traits, tree.groups)),
    ...playedBearers.flatMap((b) => inBearerOrder(activeIn(b).filter((t) => b.linkOf.has(t.id)), b)),
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
  return { world: worldPins, of, bind, copies };
}

/** What an editor preview of one bearer's trait text reads: its copies and the pins in force on it. */
export interface BearerPreview {
  copies: CopyLookup;
  pins: Record<string, string>;
}

/**
 * One bearer's trait text as a new game would read it with `traitId` on: the bearer's default traits and
 * `traitId`, minus its exclusive siblings, laying their pins on the bearer's copies. Null when the world has
 * no such bearer.
 */
export function bearerPreview(
  world: BearerWorld, sharedPlaceholders: readonly Placeholder[], placeholders: readonly Placeholder[], bearerId: string, traitId: string,
): BearerPreview | null {
  const bearer = resolveBearers(world, undefined).bearers.find((b) => b.id === bearerId);
  const trait = bearer?.traits.find((t) => t.id === traitId);
  if (!bearer?.entity || !trait) return null;
  const retired = new Set(exclusiveSiblings(trait, bearer.traits, bearer.groups));
  const defaults = defaultPicks(bearer.traits, bearer.groups);
  const on = [...defaults.filter((id) => !retired.has(id)), traitId];
  const set = bearerPins(
    { world, persona: undefined, playerTraits: [], owned: { [bearerId]: [...new Set(on)] }, sharedPlaceholders },
    { placeholders },
  );
  return { copies: set.copies(bearerId), pins: set.of(bearerId) };
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
    // A bearer tree is the owned lists, as they are, then each link's expansion.
    const linksNothing = !tree
      || (tree.traits.length === (entity.traits?.length ?? 0) && tree.groups.length === (entity.traitGroups?.length ?? 0));
    return linksNothing ? entity : { ...entity, traits: [...tree.traits], traitGroups: [...tree.groups] };
  });
}

/** The traits where the bearer's tree places them, so a linked original sits at its link and never under
 *  Blueprints. A trait the tree lacks keeps its own place. */
export function inBearerPlaces(traits: readonly Trait[], tree: BearerTree | undefined): Trait[] {
  const placed = new Map((tree?.traits ?? []).map((t) => [t.id, t]));
  return mapPreservingIdentity(traits, (trait) => {
    const at = placed.get(trait.id);
    return !at || (at.groupId === trait.groupId && at.order === trait.order) ? trait : { ...trait, groupId: at.groupId, order: at.order };
  });
}

/** Each item with the Character Name in its name and AI description written as the Player Name, for items the
 *  player bears. */
export const borneByPlayer = <T extends { name: string; aiDescription?: string }>(items: readonly T[]): T[] =>
  mapPreservingIdentity(items, (item) => {
    const name = characterAsPlayer(item.name);
    const aiDescription = item.aiDescription && characterAsPlayer(item.aiDescription);
    return name === item.name && aiDescription === item.aiDescription ? item : { ...item, name, aiDescription };
  });


/** The Traits tab tree with each linked row named for its entity bearer. `named` reads an original's authored
 *  text with that entity as the Character Name; the player's rows and owned rows keep their names. */
export function withBearerNames(
  tree: BearerTraitTree, originals: Pick<BearerWorld, 'traits' | 'traitGroups'>,
  named: (text: string, bearer: Entity, trait?: Trait) => string,
): BearerTraitTree {
  const traitsById = new Map(originals.traits.map((t) => [t.id, t]));
  const groupsById = new Map(originals.traitGroups.map((g) => [g.id, g]));
  const linkedTo = (bearerId: string, id: string) => tree.bearers.find((b) => b.id === bearerId)?.linkOf.has(id) ?? false;
  const traits = mapPreservingIdentity(tree.traits, (row) => {
    const bearerId = rowBearer(tree, row);
    const entity = tree.entityNodes.get(bearerId);
    const original = traitsById.get(row.id);
    if (!entity || !original || !linkedTo(bearerId, row.id)) return row;
    const name = named(original.name, entity, original);
    return name === row.name ? row : { ...row, name };
  });
  const groups = mapPreservingIdentity(tree.groups, (row) => {
    const bearerId = tree.bearerOfGroup.get(row.id);
    const entity = bearerId ? tree.entityNodes.get(bearerId) : undefined;
    const originalId = bearerId && row.id.startsWith(`${bearerId}/`) ? row.id.slice(bearerId.length + 1) : '';
    const original = groupsById.get(originalId);
    if (!entity || !original || !linkedTo(bearerId!, originalId)) return row;
    const name = named(original.name, entity);
    return name === row.name ? row : { ...row, name };
  });
  return traits === tree.traits && groups === tree.groups ? tree : { ...tree, traits, groups };
}

/** What roll priming walks per bearer, whoever ends up played. */
export interface BearerPriming {
  /** Each entity's own trait and group names and descriptions; linked originals are world text. */
  texts: string[];
  /** Every bearer's traits that pin, bound for that bearer. The player's bind under None and under each
   *  persona, world or library. */
  pinTraits: Trait[];
  /** Each bearer's trait text with the copy lookup its blueprint chips read through: an entity's whole tree
   *  and its own text, and the root's once per way the player can be played. */
  copyTexts: { texts: string[]; copies: CopyLookup }[];
}

export function bearerPriming(world: BearerWorld, library: readonly Entity[], shared: readonly Placeholder[]): BearerPriming {
  const { bearers } = resolveBearers(world, undefined, library);
  const texts = bearers.flatMap((bearer) => (bearer.entity ? [...bearer.traits, ...bearer.groups] : [])
    .filter((item) => !bearer.linkOf.has(item.id))
    .flatMap((item) => [item.name, item.playerDescription, item.aiDescription])
    .filter((text): text is string => !!text));
  const blueprints = { placeholders: shared, entities: world.entities };
  const libraryIds = new Set(library.map((e) => e.id));
  const playerReaders: CopyReader[] = [
    readerFor({ source: 'none' }, null, true),
    ...world.entities.filter((e) => e.persona).map((e) => readerFor({ source: 'world', entityId: e.id }, e, true)),
    ...library.map((e) => readerFor({ source: 'library', entityId: e.id }, e, true)),
  ];
  const readersOf = (bearer: Bearer) => (bearer.entity
    ? [readerFor(libraryIds.has(bearer.id) ? { source: 'library', entityId: bearer.id } : undefined, bearer.entity, bearer.isPlayer)]
    : playerReaders);
  const pinTraits = bearers.flatMap((bearer) => readersOf(bearer).flatMap((reader) => bearer.traits
    .filter((t) => t.placeholderPins?.length)
    .map((t) => bindBlueprintPins(t, blueprints, reader))));
  const copyTexts = bearers.flatMap((bearer) => {
    const own = [...bearer.traits, ...bearer.groups].flatMap((item) => [item.name, item.playerDescription, item.aiDescription]);
    const texts = [...own, ...(bearer.entity ? entityTexts(bearer.entity) : [])].filter((text): text is string => !!text);
    return texts.length ? readersOf(bearer).map((reader) => ({ texts, copies: copyLookup(blueprints, reader) })) : [];
  });
  return { texts, pinTraits, copyTexts };
}
