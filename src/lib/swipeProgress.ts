/** A glide between two places in the strip, in tabs from the first, timed like the strip's own. */
export interface SwipeGlide { from: number; to: number; duration: number; easing: string }

/** Where the strip is: under the finger (`at`), gliding, or null at rest. */
export type SwipeState = { at: number } | SwipeGlide | null;

/**
 * Where a swiped strip of panels sits, for a tab strip's pill to follow outside React renders. A drag reports
 * each move; a glide reports once, so the pill can run the same animation itself.
 */
export interface SwipeProgress {
  get: () => SwipeState;
  /** Under the finger at `at` tabs from the first, or null at rest. */
  set: (at: number | null) => void;
  glide: (glide: SwipeGlide) => void;
  subscribe: (listener: (state: SwipeState) => void) => () => void;
}

export function createSwipeProgress(): SwipeProgress {
  let state: SwipeState = null;
  const listeners = new Set<(state: SwipeState) => void>();
  const change = (next: SwipeState) => {
    state = next;
    listeners.forEach((listener) => listener(next));
  };
  return {
    get: () => state,
    set: (at) => {
      if (at === null ? state === null : state !== null && 'at' in state && state.at === at) return;
      change(at === null ? null : { at });
    },
    glide: (glide) => change(glide),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
