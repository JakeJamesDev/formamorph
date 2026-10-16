import { DEFAULT_DURATION, DEFAULT_STAGGER, type RevealTiming } from './narrationRevealConfig';

export type { RevealTiming };

// Current narration fade timing (per-word fade `duration` + word `stagger`). The sentence pacer
// (useSentenceReveal) sets it from the measured arrival rate as each sentence is released; the
// renderer reads it so its word-fade cadence matches the reveal. Kept as a module value (not React
// state) so updates don't trigger re-renders. The pacer re-seeds it to the default on reset.
let timing: RevealTiming = {
  duration: DEFAULT_DURATION,
  stagger: DEFAULT_STAGGER,
};

export const getRevealTiming = (): RevealTiming => timing;

export const setRevealTiming = (next: RevealTiming): void => {
  timing = next;
};

// How many of the reply's sentences the pacer has released to the screen; the During AI Output run reads it.
let released = 0;

export const getRevealReleased = (): number => released;

export const setRevealReleased = (count: number): void => {
  released = count;
};
