import { DEFAULT_DURATION, DEFAULT_STAGGER } from './narrationRevealConfig';

// Current narration fade timing (per-word fade `duration` + word `stagger`), tracking the model's
// smoothed output rate for the turn in progress. Kept as a module value (not React state) so the
// streaming loop can update it every token and both readers — the sentence pacer and the renderer —
// see the latest without extra re-renders. The streaming loop re-seeds it at the start of each turn.
let timing: { duration: number; stagger: number } = {
  duration: DEFAULT_DURATION,
  stagger: DEFAULT_STAGGER,
};

// Queue-feedback pace scale (owned by useSentenceReveal, ≥1): a stretch factor on top of the
// rate-derived base timing. The open-loop rate estimate can read several times too fast (the server's
// initial token burst permanently inflates its cumulative average), so the pacer observes actual
// starvation/backlog and corrects here. Both the pacer's waits and the renderer's word cadence read
// the SAME scaled values, so a stretched pace stays one seamless cascade rather than sprints with gaps.
let paceScale = 1;

export const getRevealTiming = (): { duration: number; stagger: number } => ({
  duration: timing.duration * paceScale,
  stagger: timing.stagger * paceScale,
});

export const setRevealTiming = (next: { duration: number; stagger: number }): void => {
  timing = next;
};

export const getRevealPaceScale = (): number => paceScale;

export const setRevealPaceScale = (scale: number): void => {
  paceScale = scale;
};
