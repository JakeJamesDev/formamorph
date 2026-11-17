/**
 * The Player View: what the player has met in one playthrough, in player text only. The one in-game filter
 * Formaquestion reads (ADR-0014). No row type has an AI field; AI text written in play counts as player text.
 */
import type {
  Base64Data, ChatMessage, Currency, DiscoveredEntity, Entity, GameState, Item, ItemInstance, MediaList, PlayerStat, RuntimeItem, SceneEntity, Trait, World,
} from '@/types';
import { activeDescriptor } from '@/lib/statContext';
import { visibleImages } from '@/lib/imageVisibility';
import type { GateInput } from '@/lib/traitGates';
import { instanceWorthText } from '@/lib/currency';
import { instanceFace, instanceState, isUnidentified, stateKey } from '@/lib/items';
import { resolveEntityByName } from '@/lib/entityMatch';
import { parseTurnContent } from '@/lib/turnDigest';
import { activeOwnedTraitIds } from '@/lib/ownedTraitsInPlay';
import { INITIAL_SOURCE_TURN_ID, discoveredAsEntities } from '@/lib/runtimeCharacters';
import { computePresence } from '@/lib/presence';
import { followerIds } from '@/lib/positionPlay';
import { mediaOverrideReader, type MediaOverrideReader } from '@/lib/mediaOverrides';
import { runtimePositions } from '@/lib/entityFollowing';

export interface PlayerViewEntity {
  kind: 'entity';
  id: string;
  /** The real name, or the scene alias while the name is unrevealed. */
  name: string;
  description: string;
  /** The played persona. */
  player?: true;
  /** Known by its alias only. */
  alias?: true;
  /** The other scene aliases the player saw it under, first seen first. */
  seenAliases?: string[];
  /** The first image whose Visibility rule passes. Present only when the input carries a `gate`. */
  image?: Base64Data;
}

export interface PlayerViewLocation {
  kind: 'location';
  id: string;
  name: string;
  description: string;
  current?: true;
}

export interface PlayerViewItem {
  kind: 'item';
  /** The authored item's id, or the runtime item's. An unidentified face has an id of its own ({@link unidentifiedRowId}). */
  id: string;
  name: string;
  description: string;
  /** The State word of the instances this row stands for. Absent = none. */
  state?: string;
  /** What the item is worth, such as "40 Gold". Absent on an item with no price and on an unidentified face. */
  worth?: string;
}

export interface PlayerViewStat {
  kind: 'stat';
  id: string;
  name: string;
  type: PlayerStat['type'];
  value: number;
  min: number;
  max: number;
  /** The band text the stat panel shows; empty above every band. */
  band: string;
  /** The persona entity that owns it; absent for a global stat. */
  ownerId?: string;
}

export interface PlayerViewTrait {
  kind: 'trait';
  id: string;
  name: string;
  description: string;
  ownerId?: string;
}

export interface PlayerView {
  entities: PlayerViewEntity[];
  locations: PlayerViewLocation[];
  items: PlayerViewItem[];
  stats: PlayerViewStat[];
  traits: PlayerViewTrait[];
}

export interface PlayerViewInput {
  world: Pick<World, 'entities' | 'locations' | 'traits'> & Partial<Pick<World, 'items' | 'currencies' | 'connections'>>;
  /** The snapshots from the first to the current, oldest first. The last is the current one. */
  chain: readonly GameState[];
  /** The message history as the current snapshot holds it. */
  history: readonly ChatMessage[];
  /** The played entity as play reads it, or null with no persona. */
  persona: Entity | null;
  /** Resolves placeholder chips the way the player sees them. */
  resolve: (text: string) => string;
  /** Whether a runtime character is on. `world` arrives already gated; the snapshots' runtime characters do not. */
  isEntityOn?: (entity: Entity) => boolean;
  /** Reads each entity's image Visibility rules. Without it, no row carries an image. */
  gate?: GateInput;
  /** The world's Media List, which gallery links resolve through. */
  media?: MediaList;
}

/** The state the entity rows read; a game state satisfies it. */
export type PlayerViewEntityState = Pick<GameState,
  'discoveredEntities' | 'entityPositions' | 'genericStates' | 'uniqueStates' | 'locationId' | 'metEntities' | 'strangerAliases'>;

/** Everything the entity rows read, and nothing else: no history, choices, log, page or notes. */
export interface PlayerViewEntitiesInput {
  world: Pick<World, 'entities' | 'locations'> & Partial<Pick<World, 'connections'>>;
  /** The current snapshot's entity state. */
  current: PlayerViewEntityState;
  /** The scene rows of the saved snapshots before the current one, oldest first. */
  savedVisible: readonly (readonly SceneEntity[])[];
  /** The current snapshot's scene rows. */
  currentVisible: readonly SceneEntity[];
  persona: Entity | null;
  resolve: (text: string) => string;
  isEntityOn?: (entity: Entity) => boolean;
  gate?: GateInput;
  media?: MediaList;
  /** The script overrides the snapshot shows. Absent ⇒ none. */
  mediaOverrides?: MediaOverrideReader;
}

/** Player text with chips resolved; empty when there is none. */
const textOf = (resolve: PlayerViewInput['resolve'], text: string | undefined): string => (text ? resolve(text) : '');

/** Entities stay in the cast unless persona-only and not played. */
const inCast = (entity: Entity, personaId: string | null): boolean =>
  entity.id === personaId || !(entity.personaOnly || entity.customPersona);

/** A discovered record's player text. Only an AI-invented record's text is the AI's own; a peeled copy carries
 *  its authored source's AI text, so it reads the source's player description. */
function discoveredText(record: DiscoveredEntity, world: ReadonlyMap<string, Entity>): string | undefined {
  if (record.peeledFrom !== undefined) return world.get(record.peeledFrom)?.playerDescription;
  const invented = record.sourceTurnId !== INITIAL_SOURCE_TURN_ID && !world.has(record.entity.id);
  return invented ? record.entity.aiDescription : record.entity.playerDescription;
}

/** Every aliased scene row of the chain that resolves to one of `candidates`, oldest first. */
function* aliasedRows(scenes: readonly (readonly SceneEntity[])[], candidates: readonly Entity[]): Generator<{ entity: Entity; alias: string; revealed: boolean }> {
  for (const scene of scenes) {
    for (const row of scene) {
      const alias = row.alias?.trim();
      const entity = alias ? resolveEntityByName(row.name, candidates) : undefined;
      if (alias && entity) yield { entity, alias, revealed: row.revealed };
    }
  }
}

/** Entity id → the alias each unrevealed scene row knew it by, newest last, for entities not met by name. */
function aliasesInChain(scenes: readonly (readonly SceneEntity[])[], candidates: readonly Entity[], met: ReadonlySet<string>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const { entity, alias, revealed } of aliasedRows(scenes, candidates)) if (!revealed && !met.has(entity.id)) aliases.set(entity.id, alias);
  return aliases;
}

/** Entity id → every scene alias the player saw it under, revealed or not, first seen first. */
function seenAliasesInChain(scenes: readonly (readonly SceneEntity[])[], candidates: readonly Entity[]): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  for (const { entity, alias } of aliasedRows(scenes, candidates)) {
    const list = seen.get(entity.id) ?? [];
    if (!list.includes(alias)) seen.set(entity.id, [...list, alias]);
  }
  return seen;
}

/** The ids of everyone the player knows by name in cast order, and the unmet ones among them, read from the
 *  Presence module on `current`. */
function knownIds(
  input: PlayerViewEntitiesInput, current: PlayerViewEntityState, cast: readonly Entity[], discovered: readonly DiscoveredEntity[],
): { known: string[]; unmet: Set<string> } {
  const { world, persona, resolve } = input;
  const worldIds = new Set(world.entities.map((e) => e.id));
  const poolIds = new Set(cast.map((e) => e.id));
  // A record of an authored entity is not a new character: the start rule still decides its Met.
  const authored = cast.filter((e) => worldIds.has(e.id)).map(({ strangerName, strangerDescription, ...e }) => ({
    ...e, name: resolve(e.name), ...(strangerName?.trim() && { strangerName: resolve(strangerName) }),
    ...(strangerDescription && { strangerDescription: resolve(strangerDescription) }),
  }));
  const runtime = discovered.filter((d) => !worldIds.has(d.entity.id) && poolIds.has(d.entity.id));
  const { known } = computePresence({
    entities: authored, runtime: discoveredAsEntities(runtime), positions: { ...runtimePositions(runtime), ...current.entityPositions },
    generics: current.genericStates ?? {},
    followers: followerIds(current.uniqueStates ?? {}), locationId: current.locationId, locations: world.locations,
    connections: world.connections ?? [], persona, met: current.metEntities ?? [],
    strangerAliases: current.strangerAliases ?? {}, turns: [],
  });
  return { known: known.map((p) => p.entity.id), unmet: new Set(known.filter((p) => !p.met).map((p) => p.entity.id)) };
}

/** The entity rows alone, from the entity state only. The full Player View builds its rows through this. */
export function buildPlayerViewEntities(input: PlayerViewEntitiesInput): PlayerViewEntity[] {
  const { world, persona, resolve, current } = input;
  const scenes = [...input.savedVisible, input.currentVisible];
  const personaId = persona?.id ?? null;
  const worldById = new Map(world.entities.map((e) => [e.id, e]));
  // A deleted character leaves the discovered list, so its met id resolves to nothing.
  const discovered = (current.discoveredEntities ?? []).filter((d) => input.isEntityOn?.(d.entity) ?? true);
  const pool = new Map<string, Entity>();
  const texts = new Map<string, string | undefined>();
  for (const entity of world.entities) {
    if (inCast(entity, personaId)) pool.set(entity.id, entity);
  }
  for (const record of discovered) {
    if (pool.has(record.entity.id) || !inCast(record.entity, personaId)) continue;
    pool.set(record.entity.id, record.entity);
    texts.set(record.entity.id, discoveredText(record, worldById));
  }
  const { known: knownList, unmet } = knownIds(input, current, [...pool.values()], discovered);
  const known = new Set(knownList);
  // An entity known only by an alias shows the alias alone: its player description could name it.
  const aliases = aliasesInChain(scenes, [...pool.values()], known);
  const seenAliases = seenAliasesInChain(scenes, [...pool.values()]);

  const { gate } = input;
  const withImage = (row: PlayerViewEntity, entity: Entity): PlayerViewEntity => {
    const image = gate && visibleImages(entity, gate, input.media, input.mediaOverrides?.entity(entity.id, 'image'))[0]?.data;
    return image ? { ...row, image } : row;
  };

  const rows: PlayerViewEntity[] = [];
  const seen = new Set<string>(personaId ? [personaId] : []);
  // An unmet entity the player knows by name shows its Stranger Description.
  const playerText = (entity: Entity) => (unmet.has(entity.id) ? entity.strangerDescription
    : texts.has(entity.id) ? texts.get(entity.id) : entity.playerDescription);
  const add = (entity: Entity) => {
    if (seen.has(entity.id)) return;
    seen.add(entity.id);
    const alias = aliases.get(entity.id);
    const row: PlayerViewEntity = alias !== undefined
      ? { kind: 'entity', id: entity.id, name: alias, description: '', alias: true }
      : { kind: 'entity', id: entity.id, name: resolve(entity.name), description: textOf(resolve, playerText(entity)) };
    const others = (seenAliases.get(entity.id) ?? []).filter((name) => name !== row.name);
    rows.push(withImage(others.length ? { ...row, seenAliases: others } : row, entity));
  };

  if (persona) {
    rows.push(withImage({ kind: 'entity', id: persona.id, name: resolve(persona.name), description: textOf(resolve, persona.playerDescription), player: true }, persona));
  }
  for (const id of [...known, ...aliases.keys()]) {
    const entity = pool.get(id);
    if (entity) add(entity);
  }
  return rows;
}

function viewLocations(input: PlayerViewInput, current: GameState): PlayerViewLocation[] {
  const ids: string[] = [];
  for (const message of input.history) {
    if (message.role !== 'assistant') continue;
    const locationId = parseTurnContent(message.content)?.locationId;
    if (locationId && !ids.includes(locationId)) ids.push(locationId);
  }
  if (current.locationId && !ids.includes(current.locationId)) ids.push(current.locationId);
  const byId = new Map(input.world.locations.map((l) => [l.id, l]));
  return ids.flatMap((id) => {
    const location = byId.get(id);
    if (!location) return [];
    return [{
      kind: 'location' as const, id, name: input.resolve(location.name),
      description: textOf(input.resolve, location.playerDescription || location.description),
      ...(id === current.locationId ? { current: true as const } : {}),
    }];
  });
}

/** An instance the player has met in this snapshot: visible, and held by the player or lying where the player stands. */
const metInstance = (instance: ItemInstance, snapshot: GameState): boolean =>
  instance.visibility === 'visible'
  && (instance.where.kind === 'you' || (instance.where.kind === 'location' && instance.where.id === snapshot.locationId));

/** The row id of an item's unidentified face, apart from its true face's so the two never link (Q40). */
export const unidentifiedRowId = (itemId: string): string => `${itemId}:unidentified`;

/** The row id the player knows `instance` by: its item's id, or the unidentified face's while it is unidentified. */
export const playerItemId = (instance: ItemInstance): string => (instance.item.kind === 'runtime' ? instance.item.runtimeItemId
  : isUnidentified(instance) ? unidentifiedRowId(instance.item.itemId) : instance.item.itemId);

/** The item an instance is of as the player knows it, with its player text; undefined when the item is gone. */
function copiedItem(
  instance: ItemInstance, authored: ReadonlyMap<string, Item>, runtime: ReadonlyMap<string, RuntimeItem>, currencies: readonly Currency[], items: readonly Item[],
): { id: string; name: string; text?: string; worth?: string } | undefined {
  const ref = instance.item;
  if (ref.kind === 'item') {
    const item = authored.get(ref.itemId);
    if (!item) return undefined;
    const face = instanceFace(item, instance);
    const worth = instanceWorthText(instance, item, currencies, items);
    return { id: playerItemId(instance), name: face.name, text: face.description, ...(worth && { worth }) };
  }
  // A runtime item's description is text the AI wrote in play, which counts as player text.
  const item = runtime.get(ref.runtimeItemId);
  return item && { id: item.id, name: item.name, text: item.description };
}

/** One row per met item and State. An item's States come from the latest snapshot the player met it in, so a
 *  State it has left behind never shows. */
function viewItems(input: PlayerViewInput): PlayerViewItem[] {
  const authored = new Map((input.world.items ?? []).map((item) => [item.id, item]));
  const runtime = new Map<string, RuntimeItem>();
  const met = new Map<string, { item: { id: string; name: string; text?: string; worth?: string }; at: number; states: Map<string, string | undefined> }>();
  input.chain.forEach((snapshot, at) => {
    for (const item of snapshot.runtimeItems ?? []) runtime.set(item.id, item);
    for (const instance of snapshot.itemInstances ?? []) {
      if (!metInstance(instance, snapshot)) continue;
      const item = copiedItem(instance, authored, runtime, input.world.currencies ?? [], input.world.items ?? []);
      if (!item) continue;
      const key = `${instance.item.kind}:${item.id}`;
      const row = met.get(key);
      const entry = row && row.at === at ? row : { item, at, states: new Map<string, string | undefined>() };
      if (entry !== row) met.set(key, entry);
      const byState = stateKey(instance);
      if (!entry.states.has(byState)) entry.states.set(byState, instanceState(instance));
    }
  });
  return [...met.values()].flatMap(({ item, states }) => [...states.values()].map((state) => ({
    kind: 'item' as const, id: item.id, name: input.resolve(item.name), description: textOf(input.resolve, item.text), ...(state && { state }),
    ...(item.worth && { worth: input.resolve(item.worth) }),
  })));
}

/** A stat the player sees: enabled and not hidden. */
const shownStat = (stat: PlayerStat): boolean => stat.enabled !== false && stat.hidden !== true;

function viewStats(input: PlayerViewInput, current: GameState): PlayerViewStat[] {
  const row = (stat: PlayerStat, ownerId?: string): PlayerViewStat => {
    const band = activeDescriptor(stat, stat.value)?.description;
    return {
      kind: 'stat', id: stat.id, name: input.resolve(stat.name), type: stat.type, value: stat.value, min: stat.min, max: stat.max,
      band: textOf(input.resolve, band), ...(ownerId ? { ownerId } : {}),
    };
  };
  const personaId = input.persona?.id;
  const personaStats = personaId ? current.entityStats?.[personaId] ?? [] : [];
  return [
    ...current.globalStats.filter(shownStat).map((stat) => row(stat)),
    ...personaStats.filter(shownStat).map((stat) => row(stat, personaId)),
  ];
}

function viewTraits(input: PlayerViewInput, current: GameState): PlayerViewTrait[] {
  const row = (trait: Trait, ownerId?: string): PlayerViewTrait => ({
    kind: 'trait', id: trait.id, name: input.resolve(trait.name),
    description: textOf(input.resolve, trait.playerDescription), ...(ownerId ? { ownerId } : {}),
  });
  const off = new Set([...(current.disabledTraitIds ?? []), ...(current.cascadeOffTraitIds?.global ?? [])]);
  const global = current.globalTraits.filter((t) => t.mode !== 'hidden' && !off.has(t.id)).map((t) => row(t));
  const persona = input.persona;
  if (!persona) return global;
  // A linked trait keeps its original's id, so the world's traits resolve the links.
  const byId = new Map([...input.world.traits, ...(persona.traits ?? [])].map((t) => [t.id, t]));
  const active = activeOwnedTraitIds(current.ownedTraits ?? {})[persona.id] ?? [];
  const ownedOff = new Set(current.cascadeOffTraitIds?.owners?.[persona.id] ?? []);
  const owned = active.flatMap((id) => {
    const trait = byId.get(id);
    return trait && trait.mode !== 'hidden' && !ownedOff.has(id) ? [row(trait, persona.id)] : [];
  });
  return [...global, ...owned];
}

/** The Player View of the current snapshot: the last in `chain`. */
export function buildPlayerView(input: PlayerViewInput): PlayerView {
  const current = input.chain.at(-1);
  if (!current) return { entities: [], locations: [], items: [], stats: [], traits: [] };
  return {
    entities: buildPlayerViewEntities({
      world: input.world, current, savedVisible: input.chain.slice(0, -1).map((s) => s.visibleEntities), currentVisible: current.visibleEntities,
      persona: input.persona, resolve: input.resolve, isEntityOn: input.isEntityOn, gate: input.gate, media: input.media,
      mediaOverrides: mediaOverrideReader(current.mediaOverrides, input.media, {
        genericStates: current.genericStates, locationId: current.locationId, personaId: input.persona?.id,
      }),
    }),
    locations: viewLocations(input, current),
    items: viewItems(input),
    stats: viewStats(input, current),
    traits: viewTraits(input, current),
  };
}
