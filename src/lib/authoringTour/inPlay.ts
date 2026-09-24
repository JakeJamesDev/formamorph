/**
 * In Play: one tour step's field as the player sees it and as each prompt reads it. Reader text comes from
 * the Test Bench's AI Context builders, so it is the block a real turn sends.
 */
import type { WorldRecord } from '@/components/WorldDetails';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { describePlaceholders } from '@/lib/placeholders';
import { traitScopedPins } from '@/lib/placeholderPins';
import { buildTraitWorkspace } from '@/lib/setupTraitWorkspace';
import { promptHeader } from '@/lib/promptHeader';
import { chipHeaderFormat } from '@/lib/promptTemplate';
import { splitToken } from '@/lib/promptVariables';
import {
  blockChipPlacedIn, buildAiContext, buildStatBlock, statsChipPlacedIn, type ContextBlockId,
} from '@/lib/testBench/aiContext';
import { buildLens, lensActiveTraits, resolveLensText, seedLens, type BenchLens } from '@/lib/testBench/lens';
import { settledOpeningStats } from '@/lib/testBench/opening';
import type { Connection, Entity, GameLocation, PlayerStat, Stat, Trait, TraitGroup } from '@/types';
import {
  liveTourItem, tourConnection, tourEntity, tourEntityPlaces, tourEntry, tourStat, type TourItems, type TourWorld,
} from './steps';
import { readTestLine, type TestLineScan } from './testLine';

/** The AI requests In Play can name, as the pane titles them. */
export type TourPrompt = 'Narration Prompt' | 'Location Change Prompt' | 'Stat Updates Prompt';

/** Each request's template in the active prompt preset. A reader takes its chip, and its Header, from here. */
export type TourPromptTemplates = Record<TourPrompt, string>;

/**
 * Why a reader shows what it shows. `neverReads`: the prompt has no use for this field, or the active preset
 * places no chip that carries it. `notInScene`: an
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
}

/** Where a new game starts, as far as the tour's location is concerned. */
export type StartsAt = 'here' | 'elsewhere' | 'anywhere';

/** The setup screen's trait category that holds the tour trait, with every text resolved as a player there reads it. */
export interface SetupTraitCategory {
  name: string;
  groups: TraitGroup[];
  traits: Trait[];
  exclusive: boolean;
  stats: Stat[];
  /** The traits ticked: the world's defaults, with the tour trait picked. */
  selected: string[];
}

/**
 * The game surface a field shows on. The Location tab shows the step's scene location, with its names and
 * description resolved. The entity surfaces show the tour entity's list row, its card, or both, with `at`
 * naming the entity's location, or null while it has none. The stat row shows the tour stat at its authored
 * starting value. The setup surfaces show the tour trait's category on the setup screen, and the second adds
 * the stat row at the value a new game settles it on. `never` is a field the player never sees; `none` is a step with no field.
 */
export type PlayerSurface =
  | { kind: 'libraryCard'; world: WorldRecord }
  | { kind: 'locationTab'; location: GameLocation | null; locations: GameLocation[]; connections: Connection[] }
  | { kind: 'startsHere'; startsAt: StartsAt }
  | { kind: 'entityRow' | 'entityCard' | 'entityRowAndCard'; entity: Entity | null; at: string | null }
  | { kind: 'statRow'; stat: PlayerStat | null }
  | { kind: 'setupTraits'; category: SetupTraitCategory | null }
  | { kind: 'setupTraitsAndStat'; category: SetupTraitCategory | null; stat: PlayerStat | null }
  | { kind: 'never' }
  | { kind: 'neverDictionary' }
  | { kind: 'none' };

export interface InPlaySlice {
  playerSees: PlayerSurface;
  readers: InPlayReader[];
  /** The test line's scan, on a step that reads through one. */
  testLine?: TestLineScan;
}

/** One prompt's read of a step's field, as a step declares it. */
export type ReaderSpec =
  | { prompt: TourPrompt; reads: 'never' }
  | { prompt: TourPrompt; reads: ContextBlockId; authorText: (world: TourWorld, items: TourItems) => string }
  /** The stats block in the shape the prompt's own Stats chip asks for. */
  | { prompt: TourPrompt; reads: 'statsChip'; authorText: (world: TourWorld, items: TourItems) => string }
  /** The dictionary block that holds the tour entry, when the test line fires it. */
  | { prompt: TourPrompt; reads: 'testLine'; authorText: (world: TourWorld, items: TourItems) => string };

/** A step's In Play slice, as the registry declares it. */
export interface InPlaySpec {
  sees: PlayerSurface['kind'];
  /**
   * `entity`: the lens stands at the tour entity's location, and while the entity is in no location every
   * reader that reads is `notInScene`. `connection`: the lens stands where the tour Connection leaves from.
   * `secondLocation`: the lens stands at the tour's second location. Otherwise it stands at the first.
   */
  scene?: 'entity' | 'connection' | 'secondLocation';
  /**
   * The lens plays a new game with the tour trait picked on the setup screen: the trait stands in as the lens
   * character, which applies it the way ticking it there does.
   */
  picksTrait?: boolean;
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

/**
 * The tour stat with its names resolved as a player there reads them. `settle` starts it where a new game
 * settles it, with the active traits' changes applied; otherwise it shows the authored start the readers use.
 */
function tourStatRow(world: TourWorld, items: TourItems, lens: BenchLens, settle: boolean): PlayerStat | null {
  const authored = tourStat(world, items);
  if (!authored) return null;
  const stat = settle
    ? settledOpeningStats(world, lens).find((s) => s.id === authored.id)
    : { ...authored, value: typeof authored.value === 'number' ? authored.value : authored.min };
  if (!stat) return null;
  const resolve = (text: string) => resolveLensText(text, allPlaceholders(world), lens.pins);
  return {
    ...stat,
    name: resolve(stat.name),
    descriptors: (stat.descriptors ?? []).map((d) => ({ ...d, description: resolve(d.description) })),
  };
}

/** The setup screen's category for the tour trait, as a player ticking it reads it. */
function setupCategory(world: TourWorld, items: TourItems, lens: BenchLens): SetupTraitCategory | null {
  const id = liveTourItem(world, items, 'trait');
  const category = id
    ? buildTraitWorkspace(world.traits ?? [], world.traitGroups ?? []).categories
      .find((c) => c.traits.some((t) => t.id === id))
    : undefined;
  if (!category) return null;
  const placeholders = allPlaceholders(world);
  const resolve = (text: string) => resolveLensText(text, placeholders, lens.pins);
  // A trait's own text reads its own pins over the active ones, as the setup screen reads it.
  const resolveOwn = (trait: Trait, text: string) =>
    resolveLensText(text, placeholders, traitScopedPins(trait, lens.pins, placeholders));
  return {
    name: resolve(category.name),
    groups: category.path.map((g) => ({ ...g, playerDescription: resolve(g.playerDescription ?? '') })),
    traits: category.traits.map((t) => ({
      ...t, name: resolveOwn(t, t.name), playerDescription: resolveOwn(t, t.playerDescription ?? ''),
    })),
    exclusive: category.group?.exclusive === true,
    stats: (world.stats ?? []).map((s) => ({ ...s, name: resolve(s.name) })),
    selected: lensActiveTraits(world, lens).map((t) => t.id),
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
    case 'statRow': return { kind, stat: tourStatRow(world, items, lens(), false) };
    case 'setupTraits': return { kind, category: setupCategory(world, items, lens()) };
    case 'setupTraitsAndStat':
      return { kind, category: setupCategory(world, items, lens()), stat: tourStatRow(world, items, lens(), true) };
    default: return { kind };
  }
}

/** `body` under the Header `chip` carries, in the chip's own style, with the frame's outer blank lines dropped. */
export function headedBlock(chip: string, body: string): string {
  const parts = splitToken(chip);
  const frame = parts ? promptHeader(parts.header, chipHeaderFormat(parts)) : null;
  if (!frame) return body;
  return `${frame.pre}${body}${frame.post}`.replace(/^\n+/, '').replace(/\n+$/, '');
}

/** One step's In Play slice: the surface the player sees, and each prompt's read with the author's text marked. */
export function computeInPlay(
  spec: InPlaySpec,
  world: TourWorld,
  worldId: string,
  items: TourItems,
  templates: TourPromptTemplates,
  testLine = '',
): InPlaySlice {
  // The lens stands at the step's scene, else where the tour's own location is, else where a new game starts.
  const sceneId = spec.scene === 'entity' ? entitySceneId(world, items)
    : spec.scene === 'connection' ? connectionSceneId(world, items)
      : spec.scene === 'secondLocation' ? items.secondLocation ?? null : null;
  const outOfScene = spec.scene === 'entity' && !sceneId;
  let lens: BenchLens | null = null;
  const lensHere = () => lens ??= buildLens(world, {
    ...seedLens(world, null, sceneId ?? items.location ?? null),
    pcTraitId: spec.picksTrait ? liveTourItem(world, items, 'trait') : null,
  });
  const needsContext = !outOfScene && spec.readers.some((r) => r.reads !== 'never' && r.reads !== 'statsChip' && r.reads !== 'testLine');
  const context = needsContext ? buildAiContext(world, lensHere()) : null;
  const read = usesTestLine(spec) ? readTestLine(world, items, testLine, lensHere().pins) : null;
  const readers = spec.readers.map((reader): InPlayReader => {
    const never: InPlayReader = { prompt: reader.prompt, state: 'neverReads', text: '', marks: [] };
    if (reader.reads === 'never') return never;
    if (outOfScene) return { prompt: reader.prompt, state: 'notInScene', text: '', marks: [] };
    const template = templates[reader.prompt];
    const reads = (chip: string, body: string): InPlayReader => {
      const text = headedBlock(chip, body);
      return { prompt: reader.prompt, state: 'reads', text, marks: findMarks(text, reader.authorText(world, items)) };
    };
    if (reader.reads === 'testLine') {
      const position = tourEntry(world, items)?.position === 'before' ? 'before' : 'after';
      const chip = blockChipPlacedIn(template, 'dictionary', position);
      if (chip === undefined || !read) return never;
      if (!read.fired) return { prompt: reader.prompt, state: 'noKeyword', text: '', marks: [] };
      if (!read.rendered) return { prompt: reader.prompt, state: 'noValue', text: '', marks: [] };
      return reads(chip, read.text);
    }
    if (reader.reads === 'statsChip') {
      const chip = statsChipPlacedIn(template);
      if (chip === undefined) return never;
      return reads(chip, buildStatBlock(world, lensHere(), splitToken(chip)?.key ?? chip));
    }
    const chip = blockChipPlacedIn(template, reader.reads);
    if (chip === undefined) return never;
    return reads(chip, context?.blocks.find((b) => b.id === reader.reads)?.text ?? '');
  });
  return {
    playerSees: playerSurface(spec.sees, world, worldId, items, lensHere),
    readers,
    ...(read ? { testLine: read.scan } : {}),
  };
}
