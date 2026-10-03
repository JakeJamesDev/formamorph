import { DEFAULT_DURATION, DEFAULT_STAGGER } from './narrationRevealConfig';

/** A word reveal's per-word fade length and the delay between words, in ms. */
export interface RevealTiming { duration: number; stagger: number }

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
