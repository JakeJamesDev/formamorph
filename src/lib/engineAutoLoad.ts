import { useSyncExternalStore } from 'react';

// Whether LocalEngineManager may still auto-load a model. Starts pending: until the manager decides, a
// `stopped` engine can be one that is about to load.
let pending = true;
const listeners = new Set<() => void>();

const set = (next: boolean) => {
  if (pending === next) return;
  pending = next;
  listeners.forEach((cb) => cb());
};

/** The manager is about to auto-load, or may once the boot hold lifts. */
export const markAutoLoadPending = (): void => set(true);

/** The manager's auto-load attempt finished, or it has nothing to load. */
export const markAutoLoadSettled = (): void => set(false);

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};
const read = () => pending;

/** True while a `stopped` engine may still be auto-loaded. */
export function useAutoLoadPending(): boolean {
  return useSyncExternalStore(subscribe, read, read);
}
