/**
 * The open world for Formaquestion. The game and the editor register it while they show; the help window
 * reads the newest one when a question is sent, and Try It reads it too. No registration means no world is
 * open: a Tool runs on an empty snapshot, and the code test checks no names.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';

export type ToolSnapshotSource = () => ToolSnapshot;

/** The open world's authored data, with no playthrough. */
export type StatCodeWorldSource = () => StatCodeWorld;

/** One open world, as the two readers take it. */
export interface OpenWorld {
  /** What a Formaquestion Tool reads. */
  snapshot: ToolSnapshotSource;
  /** The authored world, with no playthrough: what the code test reads. */
  authored: StatCodeWorldSource;
}

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
export function useHelpWorldSource(snapshot: ToolSnapshotSource, authored: StatCodeWorldSource): void {
  const latest = useRef({ snapshot, authored });
  latest.current = { snapshot, authored };
  useEffect(() => helpWorld.register({ snapshot: () => latest.current.snapshot(), authored: () => latest.current.authored() }), []);
}

/** The open world, or none. */
export function useHelpWorld(): OpenWorld | undefined {
  return useSyncExternalStore(helpWorld.subscribe, helpWorld.get, helpWorld.get);
}
