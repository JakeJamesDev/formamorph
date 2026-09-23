/**
 * In Play: one tour step's field as the player sees it and as each prompt reads it. Reader text comes from
 * the Test Bench's AI Context builder, so it is the block a real turn sends.
 */
import type { WorldRecord } from '@/components/WorldDetails';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { describePlaceholders } from '@/lib/placeholders';
import { buildAiContext, type ContextBlockId } from '@/lib/testBench/aiContext';
import { buildLens, seedLens } from '@/lib/testBench/lens';
import type { TourItems, TourWorld } from './steps';

/** The AI requests In Play can name, as the pane titles them. */
export type TourPrompt = 'Narration Prompt';

/**
 * Why a reader shows what it shows. `neverReads`: the prompt has no use for this field. `notInScene`: an
 * entity in no location, which no roster lists. `noKeyword`: a dictionary entry the test line does not fire.
 */
export type ReaderState = 'reads' | 'neverReads' | 'notInScene' | 'noKeyword';

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

/** The game surface a field shows on. `never` is a field the player never sees; `none` is a step with no field. */
export type PlayerSurface =
  | { kind: 'libraryCard'; world: WorldRecord }
  | { kind: 'never' }
  | { kind: 'none' };

export interface InPlaySlice {
  playerSees: PlayerSurface;
  readers: InPlayReader[];
}

/** One prompt's read of a step's field, as a step declares it. */
export type ReaderSpec =
  | { prompt: TourPrompt; reads: 'never' }
  | { prompt: TourPrompt; reads: ContextBlockId; authorText: (world: TourWorld, items: TourItems) => string };

/** A step's In Play slice, as the registry declares it. */
export interface InPlaySpec {
  sees: PlayerSurface['kind'];
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

function playerSurface(kind: PlayerSurface['kind'], world: TourWorld, worldId: string): PlayerSurface {
  return kind === 'libraryCard' ? { kind, world: libraryCardRecord(world, worldId) } : { kind };
}

/** One step's In Play slice: the surface the player sees, and each prompt's read with the author's text marked. */
export function computeInPlay(
  spec: InPlaySpec,
  world: TourWorld,
  worldId: string,
  items: TourItems,
): InPlaySlice {
  // The lens stands where the tour's own location is, or where a new game starts, with no player character.
  const needsContext = spec.readers.some((r) => r.reads !== 'never');
  const context = needsContext
    ? buildAiContext(world, buildLens(world, seedLens(world, null, items.location ?? null)))
    : null;
  const readers = spec.readers.map((reader): InPlayReader => {
    if (reader.reads === 'never' || !context) {
      return { prompt: reader.prompt, state: 'neverReads', text: '', marks: [] };
    }
    const block = reader.reads;
    const text = context.blocks.find((b) => b.id === block)?.text ?? '';
    return { prompt: reader.prompt, state: 'reads', text, marks: findMarks(text, reader.authorText(world, items)) };
  });
  return { playerSees: playerSurface(spec.sees, world, worldId), readers };
}
