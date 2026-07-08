import { DEFAULT_DURATION, DEFAULT_STAGGER } from './narrationRevealConfig';

// Current narration fade timing (per-word fade `duration` + word `stagger`). The sentence pacer
// (useSentenceReveal) sets it from the measured arrival rate as each sentence is released; the
// renderer reads it so its word-fade cadence matches the reveal. Kept as a module value (not React
// state) so updates don't trigger re-renders. The pacer re-seeds it to the default on reset.
let timing: { duration: number; stagger: number } = {
  duration: DEFAULT_DURATION,
  stagger: DEFAULT_STAGGER,
};

export const getRevealTiming = (): { duration: number; stagger: number } => timing;

export const setRevealTiming = (next: { duration: number; stagger: number }): void => {
  timing = next;
};
