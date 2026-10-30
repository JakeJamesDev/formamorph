/**
 * The Player View as a Formaquestion Tool and the code test read it in game (Q20): the Tool Snapshot's scene,
 * memory and script state, and the code test's world, cut down to what the player has met, in player text.
 */
import type { Connection, DictionaryEntry, Entity, GameLocation, GameState, Item, ItemCopy, PlayerStat, Stat, Trait, TraitGroup } from '@/types';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import type { SandboxState, StatePlaces } from '@/lib/statCodeTurn';
import type { StatCodeOwners } from '@/lib/statCodeTraits';
import type { GateEntity, GateStats } from '@/lib/traitGates';
import { stateWord } from '@/lib/items';
import { statBlueprintIds } from '@/lib/statLinks';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import type { ToolMemorySource, ToolScriptSource } from '@/lib/tools/toolSnapshot';
import { playerItemId, unidentifiedRowId, type PlayerView, type PlayerViewEntity, type PlayerViewItem, type PlayerViewLocation } from './playerView';

/** A Player View and the snapshot it was built from. */
export interface PlayerViewReach {
  view: PlayerView;
  /** The current snapshot: the last of the view's chain. */
  current: GameState;
}

/** What the player has met, by id. */
interface Met {
  entities: ReadonlyMap<string, PlayerViewEntity>;
  locations: ReadonlyMap<string, PlayerViewLocation>;
  items: ReadonlyMap<string, PlayerViewItem>;
  /** The player's traits' player text, keyed by `traitKey`. */
  traits: ReadonlyMap<string, string>;
  personaId: string | null;
  current: GameState;
}

const traitKey = (ownerId: string | null, id: string): string => `${ownerId ?? ''}:${id}`;

function metOf({ view, current }: PlayerViewReach): Met {
  return {
    entities: new Map(view.entities.map((row) => [row.id, row])),
    locations: new Map(view.locations.map((row) => [row.id, row])),
    items: new Map(view.items.map((row) => [row.id, row])),
    traits: new Map(view.traits.map((row) => [traitKey(row.ownerId ?? null, row.id), row.description])),
    personaId: view.entities.find((row) => row.player)?.id ?? null,
    current,
  };
}

/** Whether the player sees `stat` on its owner: not hidden, and not switched off in the current snapshot. */
function statShown(met: Met, stat: Stat, ownerId: string | null): boolean {
  if (stat.hidden === true) return false;
  const held = ownerId ? met.current.entityStats?.[ownerId] : met.current.globalStats;
  return (held?.find((s) => s.id === stat.id) ?? stat).enabled !== false;
}

/** `stat` without its description, which is the AI's meaning of the stat. */
const withoutDescription = <S extends Stat>(stat: S): S => ({ ...stat, description: '' });

/** The stats the player sees, without their descriptions. */
const shownStats = <S extends Stat>(met: Met, stats: readonly S[], ownerId: string | null): S[] =>
  stats.filter((stat) => statShown(met, stat, ownerId)).map(withoutDescription);

/** The player's own traits, the active global ones and the persona's, with their player text where the AI text was. */
const shownTraits = (met: Met, traits: readonly Trait[], ownerId: string | null): Trait[] => traits.flatMap((trait) => {
  const text = met.traits.get(traitKey(ownerId, trait.id));
  return text === undefined ? [] : [{ ...trait, aiDescription: text }];
});

/** The groups that hold one of `kept` at any depth, without AI-only headings or heading text; a group of only
 *  hidden or unmet rows would name them. */
function keptGroups<G extends { id: string; parentId: string | null; aiDescription?: string; aiVisible?: boolean }>(
  groups: readonly G[], kept: readonly { groupId?: string | null }[],
): G[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const keep = new Set<string>();
  for (const row of kept) {
    for (let id = row.groupId ?? null; id && !keep.has(id); id = byId.get(id)?.parentId ?? null) keep.add(id);
  }
  return groups.filter((group) => keep.has(group.id) && group.aiVisible !== false).map((group) => ({ ...group, aiDescription: undefined }));
}

/** The authored stats a link points at, to keep only links to stats the player sees. */
type LinkTargets = ReadonlyMap<string, Stat>;

/** `entity` as the player knows it: the name and player text the view holds, and only what it shows. */
function playerEntity(met: Met, entity: Entity, row: PlayerViewEntity, targets: LinkTargets = new Map()): Entity {
  const stats = entity.stats && shownStats(met, entity.stats, entity.id);
  const traits = entity.traits && shownTraits(met, entity.traits, entity.id);
  const statLinks = entity.statLinks?.filter((link) => {
    const target = targets.get(link.originalId);
    return link.kind === 'group' || (target !== undefined && statShown(met, target, entity.id));
  });
  const traitLinks = entity.traitLinks?.filter((link) => link.kind === 'trait' && met.traits.has(traitKey(entity.id, link.originalId)));
  return {
    id: entity.id, name: row.name, aliases: [...(row.seenAliases ?? [])],
    playerDescription: row.description, aiDescription: row.description,
    ...(entity.type !== undefined && { type: entity.type }),
    ...(entity.groupId !== undefined && { groupId: entity.groupId }),
    ...(entity.persona && { persona: true }),
    ...(entity.personaOnly && { personaOnly: true }),
    ...(entity.customPersona && { customPersona: true }),
    ...(entity.locations && { locations: entity.locations.filter((id) => met.locations.has(id)) }),
    ...(entity.placeholders && { placeholders: entity.placeholders }),
    ...(stats && { stats, statGroups: keptGroups(entity.statGroups ?? [], [...stats, ...(statLinks ?? [])]) }),
    ...(traits && { traits, traitGroups: keptGroups(entity.traitGroups ?? [], [...traits, ...(traitLinks ?? [])]) }),
    ...(statLinks?.length ? { statLinks } : {}),
    ...(traitLinks?.length ? { traitLinks } : {}),
  };
}

/** The met ones of `things`, each rebuilt from its Player View row. */
const keepMet = <T extends { id: string }, R>(things: readonly T[], rows: ReadonlyMap<string, R>, build: (thing: T, row: R) => T): T[] =>
  things.flatMap((thing) => {
    const row = rows.get(thing.id);
    return row ? [build(thing, row)] : [];
  });

const playerEntities = (met: Met, entities: readonly Entity[], stats: readonly Stat[] = []): Entity[] => {
  const targets = new Map(stats.map((stat) => [stat.id, stat]));
  return keepMet(entities, met.entities, (entity, row) => playerEntity(met, entity, row, targets));
};

function playerLocation(met: Met, location: GameLocation, row: PlayerViewLocation): GameLocation {
  const parentId = location.parentId && met.locations.has(location.parentId) ? location.parentId : null;
  return {
    id: location.id, name: row.name, playerDescription: row.description, aiDescription: row.description, parentId,
    ...(location.isStarting && { isStarting: true }),
  };
}

const playerLocations = (met: Met, locations: readonly GameLocation[]): GameLocation[] =>
  keepMet(locations, met.locations, (location, row) => playerLocation(met, location, row));

/** Connections between met places, without their travel hints. */
const playerConnections = (met: Met, connections: readonly Connection[] = []): Connection[] => connections
  .filter((c) => met.locations.has(c.a) && met.locations.has(c.b))
  .map((c) => ({ id: c.id, a: c.a, b: c.b, ...(c.aToB && { aToB: {} }), ...(c.bToA && { bToA: {} }) }));

function playerItem(item: Item, row: PlayerViewItem): Item {
  const { value, valueUnit, stackable, uses, whenEmpty, state, bound, slotId, slotSize, placeholders } = item;
  const { id } = row;
  return {
    id, name: row.name, playerDescription: row.description, aiDescription: row.description,
    value, valueUnit, stackable, uses, whenEmpty, state: stateWord(state), bound, slotId, slotSize, placeholders,
    statEffects: [], traitEffects: [], equipRequires: [],
  };
}

/** Each met face of `items`, under its row's id and name: the true face and the unidentified one apart (Q40). */
const metFaces = <T extends { id: string }>(met: Met, items: readonly T[], build: (item: T, row: PlayerViewItem) => T): T[] =>
  items.flatMap((item) => [item.id, unidentifiedRowId(item.id)].flatMap((id) => {
    const row = met.items.get(id);
    return row ? [build(item, row)] : [];
  }));

const playerItems = (met: Met, items: readonly Item[] = []): Item[] => metFaces(met, items, playerItem);

/** A visible copy of a met item, held by the player or a met entity, or at a met place. */
function copyShown(met: Met, copy: ItemCopy): boolean {
  if (copy.visibility !== 'visible' || !met.items.has(playerItemId(copy))) return false;
  const { where } = copy;
  return where.kind === 'you' || (where.kind === 'entity' ? met.entities.has(where.id) : met.locations.has(where.id));
}

/** The shown copies, an unidentified one pointing at its face's row so it never names the true item. */
const shownCopies = (met: Met, copies: readonly ItemCopy[]): ItemCopy[] => copies.flatMap((copy) => {
  if (!copyShown(met, copy)) return [];
  const itemId = playerItemId(copy);
  return copy.item.kind === 'item' && itemId !== copy.item.itemId ? [{ ...copy, item: { kind: 'item', itemId } }] : [copy];
});

/** Only the keys of `record` in `keep`. */
const picked = <T>(record: Readonly<Record<string, T>>, keep: (key: string) => boolean): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => keep(key)));

/** The Chip Scene a help Tool's chips render from: met rows in player text, the player's stats and traits, no lore. */
export function playerViewScene(scene: ChipScene, reach: PlayerViewReach): ChipScene {
  const met = metOf(reach);
  const { personaId } = met;
  const personaRow = personaId ? met.entities.get(personaId) : undefined;
  const metIds = (ids: readonly string[]) => ids.filter((id) => met.entities.has(id));
  return {
    overview: '',
    stats: shownStats(met, scene.stats, null),
    playedStats: scene.playedStats?.filter((part) => part.ownerId === personaId)
      .map((part) => ({ ownerId: part.ownerId, stats: shownStats(met, part.stats, part.ownerId) })),
    playedEntities: playerEntities(met, (scene.playedEntities ?? []).filter((e) => e.id === personaId)),
    traits: shownTraits(met, scene.traits, null),
    traitGroups: [],
    ownedTraits: personaId && scene.ownedTraits?.[personaId]
      ? { [personaId]: scene.ownedTraits[personaId].filter((id) => met.traits.has(traitKey(personaId, id))) } : {},
    ownedStats: personaId && scene.ownedStats?.[personaId] ? { [personaId]: shownStats(met, scene.ownedStats[personaId], personaId) } : {},
    persona: scene.persona && personaRow ? { ...scene.persona, entity: playerEntity(met, scene.persona.entity, personaRow) } : null,
    playerName: scene.playerName,
    location: scene.location && met.locations.has(scene.location.id) ? playerLocations(met, [scene.location])[0] : null,
    locations: playerLocations(met, scene.locations),
    connections: playerConnections(met, scene.connections),
    entities: playerEntities(met, scene.entities),
    presentIds: metIds(scene.presentIds),
    inSceneIds: metIds(scene.inSceneIds),
    items: playerItems(met, scene.items),
    itemCopies: scene.itemCopies && shownCopies(met, scene.itemCopies),
    runtimeItems: scene.runtimeItems?.flatMap((item) => {
      const row = met.items.get(item.id);
      return row ? [{ id: item.id, name: row.name, description: row.description }] : [];
    }),
    lore: [],
    notes: scene.notes,
    time: scene.time,
    resolve: scene.resolve,
    ...(scene.resolveEntity && { resolveEntity: scene.resolveEntity }),
    ...(scene.placeholders && { placeholders: scene.placeholders }),
    ...(scene.outerScopeEntities && { outerScopeEntities: playerEntities(met, scene.outerScopeEntities) }),
    ...(scene.inSceneNames && { inSceneNames: scene.inSceneNames }),
  };
}

/** Recall without diary entries: digests only. */
export const playerViewMemory = (memory: ToolMemorySource): ToolMemorySource => ({ ...memory, diaries: false });

/** Keeps a stat id on its owner, or on global scope under null. */
type KeepStat = (ownerId: string | null, id: string) => boolean;

/** `gateStats` with only the stats `keep` holds, on global scope and the kept owners. */
const playerGateStats = (gateStats: GateStats, keep: KeepStat, owners: ReadonlySet<string>): GateStats => ({
  global: picked(gateStats.global, (id) => keep(null, id)),
  owners: Object.fromEntries(Object.entries(gateStats.owners).flatMap(([ownerId, stats]) =>
    (owners.has(ownerId) ? [[ownerId, picked(stats, (id) => keep(ownerId, id))] as const] : []))),
});

function playerOwnerTraits(met: Met, owners: StatCodeOwners, keep: KeepStat, statOwners: ReadonlySet<string>): StatCodeOwners {
  const { personaId } = met;
  const global = shownTraits(met, owners.acquired, null);
  const kept = new Set(global.map((trait) => trait.id));
  const persona = personaId ? owners.ownedTraits?.[personaId] : undefined;
  const personaKept = (id: string) => personaId !== null && met.traits.has(traitKey(personaId, id));
  const tree = (traits: readonly Trait[], groups: readonly TraitGroup[], ownerId: string | null) => {
    const shown = shownTraits(met, traits, ownerId);
    return { traits: shown, groups: keptGroups(groups, shown) };
  };
  const gateEntities = (entities: readonly GateEntity[]) => entities.flatMap((entity) => {
    const row = met.entities.get(entity.id);
    return row ? [{ ...entity, name: row.name }] : [];
  });
  const { world } = owners;
  const base = {
    ...tree(world.traits, world.groups, null),
    ...(world.persona && { persona: world.persona }),
    ...(world.daypart && { daypart: world.daypart }),
    ...(world.gateStats && { gateStats: playerGateStats(world.gateStats, keep, statOwners) }),
    ...(world.items && {
      // Only the fields a Condition reads, so no other text of the item rides along.
      items: metFaces(met, world.items, (item, row) => ({ id: row.id, name: row.name, ...(item.slotId !== undefined && { slotId: item.slotId }) })),
    }),
    ...(world.itemCopies && { itemCopies: shownCopies(met, world.itemCopies) }),
  };
  return {
    acquired: global,
    disabledTraitIds: [],
    appliedValues: picked(owners.appliedValues, (id) => kept.has(id) || personaKept(id)),
    cascadeOffTraitIds: {},
    ownedTraits: personaId && persona ? { [personaId]: { chosen: persona.chosen.filter(personaKept), granted: (persona.granted ?? []).filter(personaKept) } } : {},
    world: world.owners
      ? {
        ...base, entities: gateEntities(world.entities), global: tree(world.global.traits, world.global.groups, null),
        owners: world.owners.flatMap((owner) => {
          const row = met.entities.get(owner.id);
          return row ? [{ ...owner, name: row.name, ...tree(owner.traits, owner.groups, owner.id) }] : [];
        }),
      }
      : { ...base, ...(world.entities && { entities: gateEntities(world.entities) }) },
    ...(owners.entities && { entities: playerEntities(met, owners.entities) }),
    ...(owners.library && { library: playerEntities(met, owners.library) }),
    ...(owners.discovered && { discovered: playerEntities(met, owners.discovered) }),
    ...(owners.inSceneIds && { inSceneIds: owners.inSceneIds.filter((id) => met.entities.has(id)) }),
  };
}

function playerPlaces(met: Met, places: StatePlaces): StatePlaces {
  return {
    locations: playerLocations(met, places.locations)
      .map(({ id, name, aiDescription, parentId, isStarting }) => ({ id, name, aiDescription, parentId, ...(isStarting && { isStarting }) })),
    location: places.location && met.locations.has(places.location.id)
      ? { id: places.location.id, name: met.locations.get(places.location.id)!.name } : null,
    ...(places.connections && { connections: playerConnections(met, places.connections) }),
  };
}

/**
 * The script state a help Tool reads: visible stats, met owners and the persona, met places and item copies, and
 * the dictionary entries in `fired`.
 */
export function playerViewState(state: SandboxState, reach: PlayerViewReach, fired: ReadonlySet<string> = new Set()): SandboxState {
  const met = metOf(reach);
  const firedOnly = <B extends { entries?: readonly DictionaryEntry[] }>(book: B): B => ({ ...book, entries: (book.entries ?? []).filter((entry) => fired.has(entry.id)) });
  const shownIds = (stats: readonly PlayerStat[], enabled: Readonly<Record<string, boolean>>) =>
    new Set(stats.filter((stat) => stat.hidden !== true && enabled[stat.id] !== false).map((stat) => stat.id));
  const global = shownIds(state.stats, state.enabled);
  const owners = state.owners?.filter((owner) => met.entities.has(owner.id)).map((owner) => {
    const ids = shownIds(owner.stats, owner.enabled);
    return { id: owner.id, stats: owner.stats.filter((stat) => ids.has(stat.id)).map(withoutDescription), enabled: picked(owner.enabled, (id) => ids.has(id)) };
  });
  const ownerIds = new Map(owners?.map((owner) => [owner.id, new Set(owner.stats.map((stat) => stat.id))]));
  const keep: KeepStat = (ownerId, id) => (ownerId === null ? global.has(id) : ownerIds.get(ownerId)?.has(id) === true);
  const statOwners = new Set(ownerIds.keys());
  return {
    ...state,
    stats: state.stats.filter((stat) => global.has(stat.id)).map(withoutDescription),
    enabled: picked(state.enabled, (id) => global.has(id)),
    ...(owners && { owners }),
    ...(state.gateStats && { gateStats: playerGateStats(state.gateStats, keep, statOwners) }),
    ownerTraits: playerOwnerTraits(met, state.ownerTraits, keep, statOwners),
    ...(state.places && { places: playerPlaces(met, state.places) }),
    ...(state.positions && { positions: picked(state.positions, (id) => met.entities.has(id) && met.locations.has(state.positions![id])) }),
    ...(state.followers && { followers: state.followers.filter((id) => met.entities.has(id)) }),
    ...(state.itemCopies && { itemCopies: shownCopies(met, state.itemCopies) }),
    ...(state.items && { items: playerItems(met, state.items) }),
    // Custom lines include the ones scripts wrote, which stay out with diaries (Q21).
    ...(state.memories && { memories: state.memories.filter((memory) => !memory.custom) }),
    // A script could list every entry unasked, so books list only the entries the question fired.
    ...(state.placeholders && {
      placeholders: {
        ...state.placeholders,
        ...(state.placeholders.dictionaries && { dictionaries: state.placeholders.dictionaries.map(firedOnly) }),
        ...(state.placeholders.libraryDictionaries && { libraryDictionaries: state.placeholders.libraryDictionaries.map(firedOnly) }),
      },
    }),
  };
}

/** The code test's world: visible stats, the player's traits, met entities and places, in player text. */
export function playerViewWorld(world: StatCodeWorld, reach: PlayerViewReach): StatCodeWorld {
  const met = metOf(reach);
  const entities = playerEntities(met, world.entities, world.stats);
  // A Blueprint stat is no one's until linked, so only the ones a met entity links stay.
  const statGroups = world.statGroups ?? [];
  const blueprints = statBlueprintIds({ stats: world.stats, statGroups });
  const linked = new Set(entities.flatMap((entity) => (entity.statLinks ?? []).map((link) => link.originalId)));
  const parentOf = new Map(statGroups.map((group) => [group.id, group.parentId]));
  const reached = (stat: Stat) => {
    if (linked.has(stat.id)) return true;
    for (let id = stat.groupId ?? null; id; id = parentOf.get(id) ?? null) if (linked.has(id)) return true;
    return false;
  };
  const stats = shownStats(met, world.stats.filter((stat) => !blueprints.has(stat.id) || reached(stat)), null);
  const traits = shownTraits(met, world.traits, null);
  return {
    ...world,
    stats, statGroups: keptGroups(statGroups, stats),
    traits, traitGroups: keptGroups(world.traitGroups ?? [], traits),
    entities, entityGroups: keptGroups(world.entityGroups ?? [], entities),
    ...(world.locations && { locations: playerLocations(met, world.locations) }),
  };
}

/** A Tool script's source: its state and the world the editor names it from, both cut to the Player View. */
export const playerViewScript = (source: ToolScriptSource, reach: PlayerViewReach, fired?: ReadonlySet<string>): ToolScriptSource => ({
  state: source.state && playerViewState(source.state, reach, fired),
  authored: source.authored && playerViewWorld(source.authored, reach),
});
