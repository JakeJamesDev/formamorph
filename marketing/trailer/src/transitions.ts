import { linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

/** The one transition every scene join uses. */
export const sceneTransition = {
  presentation: fade(),
  timing: linearTiming({ durationInFrames: 30 }),
};
