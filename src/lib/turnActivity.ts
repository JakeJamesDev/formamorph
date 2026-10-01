/**
 * Whether a game turn is generating, for code outside the game view. The gameplay provider writes it;
 * readers only watch it, so they stay out of the Turn Pipeline.
 */
import { useSyncExternalStore } from 'react';

let generating = false;
const listeners = new Set<() => void>();

export const turnActivity = {
  get: (): boolean => generating,
  set(next: boolean): void {
    if (next === generating) return;
    generating = next;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** True while a game turn generates. */
export function useTurnGenerating(): boolean {
  return useSyncExternalStore(turnActivity.subscribe, turnActivity.get);
}
