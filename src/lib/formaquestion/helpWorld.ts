/**
 * The open world as a Tool Snapshot source for Formaquestion. The game and the editor register a builder
 * while they show; the help window reads the newest one when a question is sent, and Try It reads it too.
 * No registration means no world is open, and a Tool runs on an empty snapshot.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ToolSnapshot } from '@/lib/tools/toolSnapshot';

export type ToolSnapshotSource = () => ToolSnapshot;

export interface HelpWorldRegistry {
  /** Registers a builder; the newest registered one is the open world. Returns the step that removes it. */
  register(build: ToolSnapshotSource): () => void;
  get(): ToolSnapshotSource | undefined;
  subscribe(listener: () => void): () => void;
}

export function createHelpWorldRegistry(): HelpWorldRegistry {
  const sources: ToolSnapshotSource[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    register(build) {
      sources.push(build);
      notify();
      return () => {
        const at = sources.lastIndexOf(build);
        if (at === -1) return;
        sources.splice(at, 1);
        notify();
      };
    },
    get: () => sources.at(-1),
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
 * `build`, so the source mounted last stays the open world: the in-game editor over the game.
 */
export function useHelpWorldSource(build: ToolSnapshotSource): void {
  const latest = useRef(build);
  latest.current = build;
  useEffect(() => helpWorld.register(() => latest.current()), []);
}

/** The open world's snapshot builder, or none with no world open. */
export function useHelpWorld(): ToolSnapshotSource | undefined {
  return useSyncExternalStore(helpWorld.subscribe, helpWorld.get, helpWorld.get);
}
