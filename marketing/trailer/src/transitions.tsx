import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import type { ReactElement } from 'react';

/** The 30-frame fade that joins the scenes in `timeline.tsx`. */
export const sceneTransition = {
  presentation: fade(),
  timing: linearTiming({ durationInFrames: 30 }),
};

const fadeJoin = { presentation: fade(), timing: linearTiming({ durationInFrames: 15 }) };
const wipeJoin = { presentation: wipe({ direction: 'from-left' }), timing: linearTiming({ durationInFrames: 18 }) };

/** The storyboard's three joins: cut, fade (15 frames) and one directional wipe (18 frames). */
export type TransitionName = 'cut' | 'fade' | 'wipe';

/** Frames the join overlaps the two scenes it connects. A cut has none. */
export const overlapFrames = (name: TransitionName, fps: number) => {
  if (name === 'cut') return 0;
  return (name === 'fade' ? fadeJoin : wipeJoin).timing.getDurationInFrames({ fps });
};

/** The element that goes between two `TransitionSeries.Sequence`s. A cut has none. */
export const joinElement = (name: TransitionName): ReactElement | null => {
  if (name === 'fade') return <TransitionSeries.Transition presentation={fadeJoin.presentation} timing={fadeJoin.timing} />;
  if (name === 'wipe') return <TransitionSeries.Transition presentation={wipeJoin.presentation} timing={wipeJoin.timing} />;
  return null;
};
