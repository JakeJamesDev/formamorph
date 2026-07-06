import { DEFAULT_DURATION, DEFAULT_STAGGER } from './narrationRevealConfig';

// Current narration fade timing (per-word fade `duration` + word `stagger`), tracking the model's
// smoothed output rate for the turn in progress. Kept as a module value (not React state) so the
// streaming loop can update it every token and both readers — the sentence pacer and the renderer —
// see the latest without extra re-renders. Reset to defaults at the start of each turn.
let timing: { duration: number; stagger: number } = {
  duration: DEFAULT_DURATION,
  stagger: DEFAULT_STAGGER,
};

export const getRevealTiming = (): { duration: number; stagger: number } => timing;

export const setRevealTiming = (next: { duration: number; stagger: number }): void => {
  timing = next;
};

export const resetRevealTiming = (): void => {
  timing = { duration: DEFAULT_DURATION, stagger: DEFAULT_STAGGER };
};
