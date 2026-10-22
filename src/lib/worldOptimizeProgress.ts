import { useSyncExternalStore } from 'react';

/**
 * Stored worlds whose images are being re-encoded right now, by local id, as a 0-1 fraction. A world in
 * here is about to be rewritten in storage, so the library shows the run on its tile and will not open it.
 */
const running = new Map<string, number>();
const listeners = new Set<() => void>();
// Replaced only when a run starts or ends, so its readers re-render then and not on every image.
let runningIds: ReadonlySet<string> = new Set();

const notify = () => { for (const listener of listeners) listener(); };

/** Record how far a world's optimize run has come. */
export function reportWorldOptimize(worldId: string, fraction: number): void {
  if (!running.has(worldId)) runningIds = new Set([...runningIds, worldId]);
  running.set(worldId, Math.min(1, Math.max(0, fraction)));
  notify();
}

/** Clear a world's run, whether it finished, failed, or was canceled. */
export function endWorldOptimize(worldId: string): void {
  if (!running.delete(worldId)) return;
  runningIds = new Set(running.keys());
  notify();
}

/** Whether a world is mid-run. */
export const isWorldOptimizing = (worldId: string): boolean => running.has(worldId);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** The worlds mid-run, for a view that gates actions on many of them at once. */
export function useOptimizingWorldIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => runningIds);
}

/** A world's optimize fraction while it runs, else undefined. */
export function useWorldOptimizeProgress(worldId: string): number | undefined {
  return useSyncExternalStore(subscribe, () => running.get(worldId));
}
