/**
 * In Play: one tour step's field as the player sees it and as each prompt reads it. Reader text comes from
 * the Test Bench's AI Context builders, so it is the block a real turn sends.
 */
import type { WorldRecord } from '@/components/WorldDetails';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { describePlaceholders } from '@/lib/placeholders';
import { buildAiContext, buildStatBlock, type ContextBlockId } from '@/lib/testBench/aiContext';
import { buildLens, resolveLensText, seedLens, type BenchLens } from '@/lib/testBench/lens';
import type { Connection, Entity, GameLocation, PlayerStat } from '@/types';
import { tourConnection, tourEntity, tourEntityPlaces, tourStat, type TourItems, type TourWorld } from './steps';
import { readTestLine } from './testLine';

/** The AI requests In Play can name, as the pane titles them. */
export type TourPrompt = 'Narration Prompt' | 'Location Change Prompt' | 'Stat Updates Prompt';

/**
 * Why a reader shows what it shows. `neverReads`: the prompt has no use for this field. `notInScene`: an
 * entity in no location, which no roster lists. `noKeyword`: a dictionary entry the test line does not fire.
 * `noValue`: a dictionary entry the test line fires, which adds nothing to the block until it has a Value.
 */
export type ReaderState = 'reads' | 'neverReads' | 'notInScene' | 'noKeyword' | 'noValue';

/** A run of reader text that is the author's own, as offsets into `text`. */
export interface MarkSpan {
  start: number;
  end: number;
}

export interface InPlayReader {
  prompt: TourPrompt;
  state: ReaderState;
  /** The block the prompt receives. Empty unless the state is `reads`. */
  text: string;
  marks: MarkSpan[];
  /** The Activation Tester's reason an entry did not fire, in place of the state's own line. */
  note?: string;
}

/** Where a new game starts, as far as the tour's location is concerned. */
export type StartsAt = 'here' | 'elsewhere' | 'anywhere';

/**
 * The game surface a field shows on. The Location tab shows the step's scene location, with its names and
 * description resolved. The entity surfaces show the tour entity's list row, its card, or both, with `at`
 * naming the entity's location, or null while it has none. The stat row shows the tour stat at its starting
 * value. `never` is a field the player never sees; `none` is a step with no field.
 */
export type PlayerSurface =
  | { kind: 'libraryCard'; world: WorldRecord }
  | { kind: 'locationTab'; location: GameLocation | null; locations: GameLocation[]; connections: Connection[] }
  | { kind: 'startsHere'; startsAt: StartsAt }
  | { kind: 'entityRow' | 'entityCard' | 'entityRowAndCard'; entity: Entity | null; at: string | null }
  | { kind: 'statRow'; stat: PlayerStat | null }
  | { kind: 'never' }
  | { kind: 'neverDictionary' }
  | { kind: 'none' };

export interface InPlaySlice {
  playerSees: PlayerSurface;
  readers: InPlayReader[];
}

/** One prompt's read of a step's field, as a step declares it. */
export type ReaderSpec =
  | { prompt: TourPrompt; reads: 'never' }
  | { prompt: TourPrompt; reads: ContextBlockId; authorText: (world: TourWorld, items: TourItems) => string }
  /** The stats block in the shape `chip` asks for: a shipped prompt's own Stats chip. */
  | { prompt: TourPrompt; reads: 'statsChip'; chip: string; authorText: (world: TourWorld, items: TourItems) => string }
  /** The dictionary block that holds the tour entry, when the test line fires it. */
  | { prompt: TourPrompt; reads: 'testLine'; authorText: (world: TourWorld, items: TourItems) => string };

/** A step's In Play slice, as the registry declares it. */
export interface InPlaySpec {
  sees: PlayerSurface['kind'];
  /**
   * `entity`: the lens stands at the tour entity's location, and while the entity is in no location every
   * reader that reads is `notInScene`. `connection`: the lens stands where the tour Connection leaves from.
   * Otherwise the lens stands at the tour's first location.
   */
  scene?: 'entity' | 'connection';
  readers: readonly ReaderSpec[];
}

/** Every place `needle` occurs in `text`, left to right, without overlap. Blank text marks nothing. */
export function findMarks(text: string, needle: string): MarkSpan[] {
  const find = needle.trim();
  if (!find) return [];
  const marks: MarkSpan[] = [];
  for (let at = text.indexOf(find); at >= 0; at = text.indexOf(find, at + find.length)) {
    marks.push({ start: at, end: at + find.length });
  }
  return marks;
}

/** The step reads through In Play's test line, so the pane shows one. */
export const usesTestLine = (spec: InPlaySpec): boolean => spec.readers.some((r) => r.reads === 'testLine');

/** The library card's record for the open world, read the way the stored library reads it. */
function libraryCardRecord(world: TourWorld, worldId: string): WorldRecord {
  const overview = world.worldOverview;
  return {
    id: worldId,
    name: overview.name,
    description: describePlaceholders(overview.description ?? '', allPlaceholders(world)),
    author: overview.author || '',
    thumbnail: overview.thumbnail,
    tags: overview.tags || [],
  };
}

/** The Location tab as a player standing where the lens stands reads it. */
function locationTab(world: TourWorld, lens: BenchLens): PlayerSurface {
  const resolve = (text: string) => resolveLensText(text, allPlaceholders(world), lens.pins);
  const locations = (world.locations ?? []).map((l) => ({
    ...l, name: resolve(l.name), playerDescription: resolve(l.playerDescription ?? ''),
  }));
  return {
    kind: 'locationTab',
    location: locations.find((l) => l.id === lens.location?.id) ?? null,
    locations,
    connections: world.connections ?? [],
  };
}

function startsAt(world: TourWorld, locationId: string | undefined): StartsAt {
  const starts = (world.locations ?? []).filter((l) => l.isStarting);
  if (starts.some((l) => l.id === locationId)) return 'here';
  return starts.length ? 'elsewhere' : 'anywhere';
}

/** Where the tour entity is: a tour location it is in, else any location it is in, else nowhere. */
function entitySceneId(world: TourWorld, items: TourItems): string | null {
  const [tourPlace] = tourEntityPlaces(world, items);
  if (tourPlace) return tourPlace;
  const live = new Set((world.locations ?? []).map((l) => l.id));
  return tourEntity(world, items)?.locations?.find((id) => live.has(id)) ?? null;
}

/** Where the tour Connection leaves from: its `from` end when one-way, else the first tour location. */
function connectionSceneId(world: TourWorld, items: TourItems): string | null {
  const connection = tourConnection(world, items);
  return connection && !connection.twoWay ? connection.from : items.location ?? null;
}

/** The tour entity with its name and Player-Facing Description resolved as a player there reads them. */
function entitySurface(
  kind: Extract<PlayerSurface, { entity: unknown }>['kind'], world: TourWorld, items: TourItems, lens: BenchLens,
): PlayerSurface {
  const resolve = (text: string) => resolveLensText(text, allPlaceholders(world), lens.pins);
  const entity = tourEntity(world, items);
  const sceneId = entitySceneId(world, items);
  const scene = (world.locations ?? []).find((l) => l.id === sceneId);
  return {
    kind,
    entity: entity
      ? { ...entity, name: resolve(entity.name), playerDescription: resolve(entity.playerDescription ?? '') }
      : null,
    at: scene ? resolve(scene.name) : null,
  };
}

/** The tour stat as a new game shows it, with its names resolved as a player there reads them. */
function statSurface(world: TourWorld, items: TourItems, lens: BenchLens): PlayerSurface {
  const stat = tourStat(world, items);
  if (!stat) return { kind: 'statRow', stat: null };
  const resolve = (text: string) => resolveLensText(text, allPlaceholders(world), lens.pins);
  return {
    kind: 'statRow',
    stat: {
      ...stat,
      name: resolve(stat.name),
      value: typeof stat.value === 'number' ? stat.value : stat.min,
      descriptors: (stat.descriptors ?? []).map((d) => ({ ...d, description: resolve(d.description) })),
    },
  };
}

function playerSurface(
  kind: PlayerSurface['kind'], world: TourWorld, worldId: string, items: TourItems, lens: () => BenchLens,
): PlayerSurface {
  switch (kind) {
    case 'libraryCard': return { kind, world: libraryCardRecord(world, worldId) };
    case 'locationTab': return locationTab(world, lens());
    case 'startsHere': return { kind, startsAt: startsAt(world, items.location) };
    case 'entityRow':
    case 'entityCard':
    case 'entityRowAndCard': return entitySurface(kind, world, items, lens());
    case 'statRow': return statSurface(world, items, lens());
    default: return { kind };
  }
}

/** One step's In Play slice: the surface the player sees, and each prompt's read with the author's text marked. */
export function computeInPlay(
  spec: InPlaySpec,
  world: TourWorld,
  worldId: string,
  items: TourItems,
  testLine = '',
): InPlaySlice {
  // The lens stands at the step's scene, else where the tour's own location is, else where a new game starts,
  // with no player character.
  const sceneId = spec.scene === 'entity' ? entitySceneId(world, items)
    : spec.scene === 'connection' ? connectionSceneId(world, items) : null;
  const outOfScene = spec.scene === 'entity' && !sceneId;
  let lens: BenchLens | null = null;
  const lensHere = () => lens ??= buildLens(world, seedLens(world, null, sceneId ?? items.location ?? null));
  const needsContext = !outOfScene && spec.readers.some((r) => r.reads !== 'never' && r.reads !== 'statsChip' && r.reads !== 'testLine');
  const context = needsContext ? buildAiContext(world, lensHere()) : null;
  const readers = spec.readers.map((reader): InPlayReader => {
    if (reader.reads !== 'never' && outOfScene) {
      return { prompt: reader.prompt, state: 'notInScene', text: '', marks: [] };
    }
    if (reader.reads === 'never') {
      return { prompt: reader.prompt, state: 'neverReads', text: '', marks: [] };
    }
    if (reader.reads === 'testLine') {
      const read = readTestLine(world, items, testLine, lensHere().pins);
      if (!read.fired) return { prompt: reader.prompt, state: 'noKeyword', text: '', marks: [], note: read.reason };
      if (!read.rendered) return { prompt: reader.prompt, state: 'noValue', text: '', marks: [] };
      return {
        prompt: reader.prompt, state: 'reads', text: read.text, marks: findMarks(read.text, reader.authorText(world, items)),
      };
    }
    const block = reader.reads;
    const text = block === 'statsChip'
      ? buildStatBlock(world, lensHere(), reader.chip)
      : context?.blocks.find((b) => b.id === block)?.text ?? '';
    return { prompt: reader.prompt, state: 'reads', text, marks: findMarks(text, reader.authorText(world, items)) };
  });
  return {
    playerSees: playerSurface(spec.sees, world, worldId, items, lensHere),
    readers,
  };
}
