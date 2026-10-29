/**
 * The open world for Formaquestion. The game and the editor register it while they show; the help window
 * reads the newest one when a question is sent, and Try It reads it too. No registration means no world is
 * open: a Tool runs on an empty snapshot, and the code test checks no names.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';
import type { DictionaryEntry } from '@/types';
import type { GameWorldInput } from './gameWorld';
import type { WorldSource } from './helpWorldSource';
import { worldIndexOf, type WorldIndexInput } from './worldIndex';

/** What a Tool reads. In game, `fired` fills each dictionary book's script entries with the question's fired entries. */
export type ToolSnapshotSource = (fired?: readonly DictionaryEntry[]) => ToolSnapshot;

/** The open world's authored data, with no playthrough. */
export type StatCodeWorldSource = () => StatCodeWorld;

/** The screen a world is open on: it sets how Formaquestion reads the world. */
export type WorldLean = 'editor' | 'game';

/** One open world, as its readers take it. */
export interface OpenWorld {
  lean: WorldLean;
  /** What a Formaquestion Tool reads. */
  snapshot: ToolSnapshotSource;
  /** The authored world, with no playthrough: what the code test reads. */
  authored: StatCodeWorldSource;
  /** The editor's live world, unsaved edits included: what the World Index reads. */
  world?: () => WorldIndexInput;
  /** The game's Player View, story so far and lore: what the game lean reads. */
  game?: () => GameWorldInput;
  /** Opens a world source's item on the screen. Absent: a source is a plain name. */
  open?: (source: WorldSource) => void;
}

/** How a screen registers its world. */
export type OpenWorldOptions = Pick<OpenWorld, 'lean' | 'world' | 'game' | 'open'>;

export interface HelpWorldRegistry {
  /** Registers a world; the newest registered one is the open world. Returns the step that removes it. */
  register(world: OpenWorld): () => void;
  get(): OpenWorld | undefined;
  subscribe(listener: () => void): () => void;
}

export function createHelpWorldRegistry(): HelpWorldRegistry {
  const worlds: OpenWorld[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    register(world) {
      worlds.push(world);
      notify();
      return () => {
        const at = worlds.lastIndexOf(world);
        if (at === -1) return;
        worlds.splice(at, 1);
        notify();
      };
    },
    get: () => worlds.at(-1),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The app's one registry. */
export const helpWorld = createHelpWorldRegistry();

/**
 * Registers the open world while the caller is mounted. One registration per mount, reading the newest
 * builders, so the source mounted last stays the open world: the in-game editor over the game.
 */
export function useHelpWorldSource(snapshot: ToolSnapshotSource, authored: StatCodeWorldSource, { lean, world, game, open }: OpenWorldOptions): void {
  const latest = useRef({ snapshot, authored, world, game, open });
  latest.current = { snapshot, authored, world, game, open };
  const hasWorld = world !== undefined;
  const hasGame = game !== undefined;
  const opens = open !== undefined;
  useEffect(() => helpWorld.register({
    lean,
    snapshot: (fired) => latest.current.snapshot(fired),
    authored: () => latest.current.authored(),
    ...(hasWorld && { world: () => latest.current.world!() }),
    ...(hasGame && { game: () => latest.current.game!() }),
    ...(opens && { open: (source: WorldSource) => latest.current.open!(source) }),
  }), [lean, hasWorld, hasGame, opens]);
}

/** How long the World Index waits after the last edit before it rebuilds. */
export const WORLD_INDEX_DEBOUNCE_MS = 500;

/**
 * Rebuilds the World Index once the world rests, so a question after an edit seldom waits for the build. A
 * question asked sooner builds it then, from the same live world.
 */
export function useWorldIndexWarmup(world: () => WorldIndexInput): void {
  useEffect(() => {
    const timer = setTimeout(() => worldIndexOf(world()), WORLD_INDEX_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [world]);
}

/** The open world, or none. */
export function useHelpWorld(): OpenWorld | undefined {
  return useSyncExternalStore(helpWorld.subscribe, helpWorld.get, helpWorld.get);
}
