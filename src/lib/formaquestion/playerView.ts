/**
 * The Player View: what the player has met in one playthrough, in player text only. The one in-game filter
 * Formaquestion reads (ADR-0014). No row type has an AI field; AI text written in play counts as player text.
 */
import type {
  ChatMessage, DiscoveredEntity, Entity, GameState, Item, ItemCopy, PlayerStat, RuntimeItem, Trait, World,
} from '@/types';
import { activeDescriptor } from '@/lib/statContext';
import { resolveEntityByName } from '@/lib/entityMatch';
import { parseTurnContent } from '@/lib/turnDigest';
import { activeOwnedTraitIds } from '@/lib/ownedTraitsInPlay';
import { INITIAL_SOURCE_TURN_ID } from '@/lib/runtimeCharacters';

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
  /** The authored item's id, or the runtime item's. */
  id: string;
  name: string;
  description: string;
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
  world: Pick<World, 'entities' | 'locations' | 'traits'> & Partial<Pick<World, 'items'>>;
  /** The snapshots from the first to the current, oldest first. The last is the current one. */
  chain: readonly GameState[];
  /** The message history as the current snapshot holds it. */
  history: readonly ChatMessage[];
  /** The played entity as play reads it, or null with no persona. */
  persona: Entity | null;
  /** Resolves placeholder chips the way the player sees them. */
  resolve: (text: string) => string;
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

/** Entity id → the alias each unrevealed scene row knew it by, newest last, for entities not met by name. */
function aliasesInChain(chain: readonly GameState[], candidates: readonly Entity[], met: ReadonlySet<string>): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const snapshot of chain) {
    for (const row of snapshot.visibleEntities) {
      const alias = row.alias?.trim();
      if (row.revealed || !alias) continue;
      const entity = resolveEntityByName(row.name, candidates);
      if (entity && !met.has(entity.id)) aliases.set(entity.id, alias);
    }
  }
  return aliases;
}

function viewEntities(input: PlayerViewInput, current: GameState): PlayerViewEntity[] {
  const { world, persona, resolve } = input;
  const personaId = persona?.id ?? null;
  const worldById = new Map(world.entities.map((e) => [e.id, e]));
  // A deleted character leaves the discovered list, so its met id resolves to nothing.
  const discovered = current.discoveredEntities ?? [];
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
  const met = new Set(current.metEntities ?? []);
  // An entity known only by an alias shows the alias alone: its player description could name it.
  const aliases = aliasesInChain(input.chain, [...pool.values()], met);

  const rows: PlayerViewEntity[] = [];
  const seen = new Set<string>(personaId ? [personaId] : []);
  const add = (entity: Entity) => {
    if (seen.has(entity.id)) return;
    seen.add(entity.id);
    const alias = aliases.get(entity.id);
    rows.push(alias !== undefined
      ? { kind: 'entity', id: entity.id, name: alias, description: '', alias: true }
      : { kind: 'entity', id: entity.id, name: resolve(entity.name), description: textOf(resolve, texts.has(entity.id) ? texts.get(entity.id) : entity.playerDescription) });
  };

  if (persona) {
    rows.push({ kind: 'entity', id: persona.id, name: resolve(persona.name), description: textOf(resolve, persona.playerDescription), player: true });
  }
  for (const id of [...met, ...discovered.map((d) => d.entity.id), ...aliases.keys()]) {
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

/** A copy the player has met in this snapshot: visible, and held by the player or lying where the player stands. */
const metCopy = (copy: ItemCopy, snapshot: GameState): boolean =>
  copy.visibility === 'visible'
  && (copy.where.kind === 'you' || (copy.where.kind === 'location' && copy.where.id === snapshot.locationId));

/** The item a copy is of, with its player text; undefined when the item is gone. */
function copiedItem(
  ref: ItemCopy['item'], authored: ReadonlyMap<string, Item>, runtime: ReadonlyMap<string, RuntimeItem>,
): { id: string; name: string; text?: string } | undefined {
  if (ref.kind === 'item') {
    const item = authored.get(ref.itemId);
    return item && { id: item.id, name: item.name, text: item.playerDescription };
  }
  // A runtime item's description is text the AI wrote in play, which counts as player text.
  const item = runtime.get(ref.runtimeItemId);
  return item && { id: item.id, name: item.name, text: item.description };
}

function viewItems(input: PlayerViewInput): PlayerViewItem[] {
  const authored = new Map((input.world.items ?? []).map((item) => [item.id, item]));
  const runtime = new Map<string, RuntimeItem>();
  const rows: PlayerViewItem[] = [];
  const seen = new Set<string>();
  for (const snapshot of input.chain) {
    for (const item of snapshot.runtimeItems ?? []) runtime.set(item.id, item);
    for (const copy of snapshot.itemCopies ?? []) {
      if (!metCopy(copy, snapshot)) continue;
      const met = copiedItem(copy.item, authored, runtime);
      const key = `${copy.item.kind}:${met?.id}`;
      if (!met || seen.has(key)) continue;
      seen.add(key);
      rows.push({ kind: 'item', id: met.id, name: input.resolve(met.name), description: textOf(input.resolve, met.text) });
    }
  }
  return rows;
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
    entities: viewEntities(input, current),
    locations: viewLocations(input, current),
    items: viewItems(input),
    stats: viewStats(input, current),
    traits: viewTraits(input, current),
  };
}
