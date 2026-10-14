// Owned traits during play: which are active, and the pins each owner's traits lay.

import type { DiscoveredEntity, Entity, OwnedTraitStates, PersonaRef, Placeholder, Trait, TraitGroup } from '@/types';
import { resolveOwners, type Owner, type OwnerWorld } from './owners';
import { copyLookup, customPersonaEntity, readerFor, type CopyLookup, type CopyReader } from './blueprints';
import { characterAsPlayer } from './builtinPlaceholders';
import { entityTexts } from './entityTexts';
import { bindBlueprintPins, collectPins, type PinSources } from './placeholderPins';
import { bindOwnedTraits, type TraitWorld } from './portableTraits';
import { INITIAL_SOURCE_TURN_ID } from './runtimeCharacters';
import { defaultPicks, exclusiveSiblings, inAuthoredOrder, traitOrderIndex } from './traitEffects';
import { PLAYER_OWNER, type GateOwner } from './traitGates';
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

/** Every present owner as the gate module reads it in play: the player, the world's entities, then the
 *  library's. */
export const inPlayOwners = (world: OwnerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = []): readonly GateOwner[] =>
  resolveOwners(world, persona, library).gate.owners;

/** The player-facing Traits tree: the player owner's rows at the top level, and a node for each present
 *  entity owner with its tree below it. Trait ids are the originals', so active state reads them as they
 *  are; a trait under two owners is two rows with one id, told apart by the owner whose node holds it. */
export interface OwnerTraitTree {
  groups: TraitGroup[];
  traits: Trait[];
  /** Entity node id → the entity it draws. */
  entityNodes: Map<string, Entity>;
  /** Group row id → the entity owner whose tree holds it: the node itself and every group below it. The
   *  player owner's groups are absent, so a trait row's owner is its group's, else the player. */
  ownerOfGroup: Map<string, string>;
  owners: Owner[];
}

/** The row id of an entity owner's group. Two owners may link one group, so its id alone cannot be a row. */
export const ownerGroupId = (ownerId: string, groupId: string): string => `${ownerId}/${groupId}`;

/** Every present owner's tree in one list, in the order Enter World and the Traits tab draw it: an entity
 *  node sits where its placement puts it; an unplaced node goes to the end of the top level, in entity
 *  order, and the library's nodes come last. The picked persona takes the Custom Persona entity's slot,
 *  leaving its own placement; the marked entity's node, when present, follows it directly. */
export function ownerTraitTree(world: OwnerWorld, persona: PersonaRef | undefined, library: readonly Entity[] = []): OwnerTraitTree {
  const { owners } = resolveOwners(world, persona, library);
  const player = owners.find((b) => b.id === PLAYER_OWNER)!;
  const played = playedEntityId(persona);
  const marked = customPersonaEntity(world.entities);
  // The entity whose place a node takes: the marked entity for the picked persona, else its own.
  const slotOf = (b: Owner) => (marked && b.id === played ? marked : b.entity!);
  const rank = new Map(owners.map((b, i) => [b.id, i]));
  // Two nodes in one slot: the picked persona comes first, the marked entity right after.
  const playedFirst = (a: Owner, b: Owner) => (a.id === played ? -1 : b.id === played ? 1 : 0);
  const nodes = owners.filter((b) => b.entity && b.present)
    .sort((a, b) => (rank.get(slotOf(a).id)! - rank.get(slotOf(b).id)!) || playedFirst(a, b));
  const placeable = placeableGroupIds(world.traitGroups);
  const libraryIds = new Set(library.map((e) => e.id));
  const placementOf = (b: Owner) => {
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
  const ownerOfGroup = new Map<string, string>();
  let unplaced = 0;
  for (const owner of nodes) {
    entityNodes.set(owner.id, owner.entity!);
    ownerOfGroup.set(owner.id, owner.id);
    const placement = placementOf(owner);
    groups.push({
      id: owner.id, name: owner.name,
      parentId: placement?.groupId ?? null, order: placement ? placement.order : firstNodeOrder + unplaced++,
    });
    const ownIds = new Set(owner.groups.map((g) => g.id));
    const parent = (ref: string | null | undefined) => (ref != null && ownIds.has(ref) ? ownerGroupId(owner.id, ref) : owner.id);
    for (const g of owner.groups) {
      groups.push({ ...g, id: ownerGroupId(owner.id, g.id), parentId: parent(g.parentId) });
      ownerOfGroup.set(ownerGroupId(owner.id, g.id), owner.id);
    }
    for (const t of owner.traits) traits.push({ ...t, groupId: parent(t.groupId) });
  }
  return { groups, traits, entityNodes, ownerOfGroup, owners };
}

/** The entity nodes that are the player's, in node order: the played persona, and the Custom Persona
 *  entity under None and a library persona. Each wears the You mark. */
export const playerEntityIds = (tree: Pick<OwnerTraitTree, 'owners'>): string[] =>
  tree.owners.filter((b) => b.entity && b.isPlayer && b.present).map((b) => b.id);

/** The owner a tree row belongs to: its group's entity owner, else the player. */
export const rowOwner = (tree: Pick<OwnerTraitTree, 'ownerOfGroup'>, row: Pick<Trait, 'groupId'>): string =>
  (row.groupId != null ? tree.ownerOfGroup.get(row.groupId) : undefined) ?? PLAYER_OWNER;

/** What every owner's pins are read from in play. */
export interface OwnerPinState {
  world: OwnerWorld;
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

/** The pins in force per owner. */
export interface PinSet {
  /** World-level text, and the played persona's own: the world pins plus the player's traits. */
  world: Record<string, string>;
  /** One owner's own text. A cast entity's lays its traits over `world`; the played persona, null and the
   *  player owner read `world`. */
  of: (ownerId: string | null | undefined) => Record<string, string>;
  /** The trait with its blueprint pins traced to that owner's copies, for its own card. */
  bind: (trait: Trait, ownerId: string | null | undefined) => Trait;
  /** The copy lookup an owner's trait text resolves its blueprint chips through. */
  copies: (ownerId: string | null | undefined) => CopyLookup;
}

/**
 * The pins in force per owner, with `sources` supplying the world pins. The player's traits lay first: the
 * world traits and each played entity's own, together in one-tree order, then the played entities' links. A
 * played entity is the world persona, or the Custom Persona entity and a library persona. A cast entity's
 * active traits lay after them in its own tree order, so it wins in its own text. Only the player's traits
 * switch stat bands.
 */
export function ownerPins(state: OwnerPinState, sources: Omit<PinSources, 'traits' | 'disabledTraitIds' | 'statTraits'>): PinSet {
  const { world, persona, library = [], owned, sharedPlaceholders } = state;
  const { owners } = resolveOwners(world, persona, library);
  const played = playedEntityId(persona);
  const playerOwner = owners.find((b) => b.id === PLAYER_OWNER);
  const playedOwners = owners.filter((b) => b.isPlayer && b.entity);
  const personaEntity = played ? [...world.entities, ...library].find((e) => e.id === played) ?? null : null;
  const isPlayer = (id: string | null | undefined) => !id || id === PLAYER_OWNER || playedOwners.some((b) => b.id === id);

  const blueprints = { placeholders: sharedPlaceholders, entities: world.entities };
  const readerOf = (id: string | null | undefined): CopyReader => (isPlayer(id)
    ? readerFor(persona, personaEntity, true)
    : readerFor(persona, owners.find((b) => b.id === id)?.entity ?? null, false));
  const bind = (trait: Trait, id: string | null | undefined) => bindBlueprintPins(trait, blueprints, readerOf(id));
  const lookups = new Map<string, CopyLookup>();
  const copies = (id: string | null | undefined) => {
    const key = isPlayer(id) ? PLAYER_OWNER : id!;
    let lookup = lookups.get(key);
    if (!lookup) lookups.set(key, (lookup = copyLookup(blueprints, readerOf(id))));
    return lookup;
  };
  const activeIn = (owner: Owner | undefined) => {
    const on = new Set(owner ? owned[owner.id] ?? [] : []);
    return owner ? owner.traits.filter((t) => on.has(t.id)) : [];
  };

  const off = new Set(state.disabledTraitIds ?? []);
  const tree = ownerTraitTree(world, persona, library);
  const heldIds = new Set(playerOwner?.traits.map((t) => t.id));
  const playedOwn = playedOwners.flatMap((b) => activeIn(b).filter((t) => !b.linkOf.has(t.id)));
  const playerTraits = [
    ...inAuthoredOrder([...state.playerTraits.filter((t) => heldIds.has(t.id)), ...playedOwn], traitOrderIndex(tree.traits, tree.groups)),
    ...playedOwners.flatMap((b) => inOwnerOrder(activeIn(b).filter((t) => b.linkOf.has(t.id)), b)),
  ].filter((t) => !off.has(t.id));
  const playerLaid = playerTraits.map((t) => bind(t, null));
  const collect = (traits: readonly Trait[]) => collectPins({ ...sources, traits, statTraits: playerTraits });

  const worldPins = collect(playerLaid);
  const cache = new Map<string, Record<string, string>>();
  const of = (id: string | null | undefined) => {
    if (isPlayer(id)) return worldPins;
    let pins = cache.get(id!);
    if (!pins) {
      const owner = owners.find((b) => b.id === id);
      const own = owner ? inOwnerOrder(activeIn(owner), owner).map((t) => bind(t, id)).filter((t) => t.placeholderPins?.length) : [];
      cache.set(id!, (pins = own.length ? collect([...playerLaid, ...own]) : worldPins));
    }
    return pins;
  };
  return { world: worldPins, of, bind, copies };
}

/** What an editor preview of one owner's trait text reads: its copies and the pins in force on it. */
export interface OwnerPreview {
  copies: CopyLookup;
  pins: Record<string, string>;
}

/**
 * One owner's trait text as a new game would read it with `traitId` on: the owner's default traits and
 * `traitId`, minus its exclusive siblings, laying their pins on the owner's copies. Null when the world has
 * no such owner.
 */
export function ownerPreview(
  world: OwnerWorld, sharedPlaceholders: readonly Placeholder[], placeholders: readonly Placeholder[], ownerId: string, traitId: string,
): OwnerPreview | null {
  const owner = resolveOwners(world, undefined).owners.find((b) => b.id === ownerId);
  const trait = owner?.traits.find((t) => t.id === traitId);
  if (!owner?.entity || !trait) return null;
  const retired = new Set(exclusiveSiblings(trait, owner.traits, owner.groups));
  const defaults = defaultPicks(owner.traits, owner.groups);
  const on = [...defaults.filter((id) => !retired.has(id)), traitId];
  const set = ownerPins(
    { world, persona: undefined, playerTraits: [], owned: { [ownerId]: [...new Set(on)] }, sharedPlaceholders },
    { placeholders },
  );
  return { copies: set.copies(ownerId), pins: set.of(ownerId) };
}

const inOwnerOrder = (traits: readonly Trait[], owner: Owner): Trait[] =>
  inAuthoredOrder(traits, traitOrderIndex(owner.traits, owner.groups));

/** One owner's effective tree, as an entity's AI context reads it. */
export type OwnerTree = Pick<GateOwner, 'id' | 'traits' | 'groups'>;

/** Each entity with its owner tree as its traits and groups, so its links read like owned traits. An entity
 *  with no owner, or with nothing linked, stays as it is. */
export function withOwnerTrees(entities: readonly Entity[], trees: readonly OwnerTree[] | undefined): Entity[] {
  const byId = new Map((trees ?? []).map((tree) => [tree.id, tree]));
  return mapPreservingIdentity(entities, (entity) => {
    const tree = byId.get(entity.id);
    // An owner tree is the owned lists, as they are, then each link's expansion.
    const linksNothing = !tree
      || (tree.traits.length === (entity.traits?.length ?? 0) && tree.groups.length === (entity.traitGroups?.length ?? 0));
    return linksNothing ? entity : { ...entity, traits: [...tree.traits], traitGroups: [...tree.groups] };
  });
}

/** The traits where the owner's tree places them, so a linked original sits at its link and never under
 *  Blueprints. A trait the tree lacks keeps its own place. */
export function inOwnerPlaces(traits: readonly Trait[], tree: OwnerTree | undefined): Trait[] {
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


/** The Traits tab tree with each linked row named for its entity owner. `named` reads an original's authored
 *  text with that entity as the Character Name; the player's rows and owned rows keep their names. */
export function withOwnerNames(
  tree: OwnerTraitTree, originals: Pick<OwnerWorld, 'traits' | 'traitGroups'>,
  named: (text: string, owner: Entity, trait?: Trait) => string,
): OwnerTraitTree {
  const traitsById = new Map(originals.traits.map((t) => [t.id, t]));
  const groupsById = new Map(originals.traitGroups.map((g) => [g.id, g]));
  const linkedTo = (ownerId: string, id: string) => tree.owners.find((b) => b.id === ownerId)?.linkOf.has(id) ?? false;
  const traits = mapPreservingIdentity(tree.traits, (row) => {
    const ownerId = rowOwner(tree, row);
    const entity = tree.entityNodes.get(ownerId);
    const original = traitsById.get(row.id);
    if (!entity || !original || !linkedTo(ownerId, row.id)) return row;
    const name = named(original.name, entity, original);
    return name === row.name ? row : { ...row, name };
  });
  const groups = mapPreservingIdentity(tree.groups, (row) => {
    const ownerId = tree.ownerOfGroup.get(row.id);
    const entity = ownerId ? tree.entityNodes.get(ownerId) : undefined;
    const originalId = ownerId && row.id.startsWith(`${ownerId}/`) ? row.id.slice(ownerId.length + 1) : '';
    const original = groupsById.get(originalId);
    if (!entity || !original || !linkedTo(ownerId!, originalId)) return row;
    const name = named(original.name, entity);
    return name === row.name ? row : { ...row, name };
  });
  return traits === tree.traits && groups === tree.groups ? tree : { ...tree, traits, groups };
}

/** What roll priming walks per owner, whoever ends up played. */
export interface OwnerPriming {
  /** Each entity's own trait and group names and descriptions; linked originals are world text. */
  texts: string[];
  /** Every owner's traits that pin, bound for that owner. The player's bind under None and under each
   *  persona, world or library. */
  pinTraits: Trait[];
  /** Each owner's trait text with the copy lookup its blueprint chips read through: an entity's whole tree
   *  and its own text, and the root's once per way the player can be played. */
  copyTexts: { texts: string[]; copies: CopyLookup }[];
}

export function ownerPriming(world: OwnerWorld, library: readonly Entity[], shared: readonly Placeholder[]): OwnerPriming {
  const { owners } = resolveOwners(world, undefined, library);
  const texts = owners.flatMap((owner) => (owner.entity ? [...owner.traits, ...owner.groups] : [])
    .filter((item) => !owner.linkOf.has(item.id))
    .flatMap((item) => [item.name, item.playerDescription, item.aiDescription])
    .filter((text): text is string => !!text));
  const blueprints = { placeholders: shared, entities: world.entities };
  const libraryIds = new Set(library.map((e) => e.id));
  const playerReaders: CopyReader[] = [
    readerFor({ source: 'none' }, null, true),
    ...world.entities.filter((e) => e.persona).map((e) => readerFor({ source: 'world', entityId: e.id }, e, true)),
    ...library.map((e) => readerFor({ source: 'library', entityId: e.id }, e, true)),
  ];
  const readersOf = (owner: Owner) => (owner.entity
    ? [readerFor(libraryIds.has(owner.id) ? { source: 'library', entityId: owner.id } : undefined, owner.entity, owner.isPlayer)]
    : playerReaders);
  const pinTraits = owners.flatMap((owner) => readersOf(owner).flatMap((reader) => owner.traits
    .filter((t) => t.placeholderPins?.length)
    .map((t) => bindBlueprintPins(t, blueprints, reader))));
  const copyTexts = owners.flatMap((owner) => {
    const own = [...owner.traits, ...owner.groups].flatMap((item) => [item.name, item.playerDescription, item.aiDescription]);
    const texts = [...own, ...(owner.entity ? entityTexts(owner.entity) : [])].filter((text): text is string => !!text);
    return texts.length ? readersOf(owner).map((reader) => ({ texts, copies: copyLookup(blueprints, reader) })) : [];
  });
  return { texts, pinTraits, copyTexts };
}

// Old names, kept while call sites move to the owner names.
export const inPlayBearers = inPlayOwners;
export type BearerTraitTree = OwnerTraitTree;
export const bearerGroupId = ownerGroupId;
export const bearerTraitTree = ownerTraitTree;
export const rowBearer = rowOwner;
export type BearerPinState = OwnerPinState;
export const bearerPins = ownerPins;
export type BearerPreview = OwnerPreview;
export const bearerPreview = ownerPreview;
export type BearerTree = OwnerTree;
export const withBearerTrees = withOwnerTrees;
export const inBearerPlaces = inOwnerPlaces;
export const withBearerNames = withOwnerNames;
export type BearerPriming = OwnerPriming;
export const bearerPriming = ownerPriming;
