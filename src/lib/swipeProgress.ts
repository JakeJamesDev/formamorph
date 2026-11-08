/**
 * Where a swiped strip of panels sits, in tabs from the first (1.5 is half way from the second to the third),
 * or null at rest. The strip publishes it every frame it moves and a tab strip's pill follows, both outside
 * React renders.
 */
export interface SwipeProgress {
  get: () => number | null;
  set: (position: number | null) => void;
  subscribe: (listener: (position: number | null) => void) => () => void;
}

export function createSwipeProgress(): SwipeProgress {
  let position: number | null = null;
  const listeners = new Set<(position: number | null) => void>();
  return {
    get: () => position,
    set: (next) => {
      if (next === position) return;
      position = next;
      listeners.forEach((listener) => listener(next));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
