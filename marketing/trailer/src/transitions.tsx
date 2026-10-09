import { TransitionSeries, linearTiming, type TransitionTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import type { ReactElement } from 'react';

/** A join between two scenes: the element that goes between their `TransitionSeries.Sequence`s, and how long it overlaps them. */
export type Join = { element: ReactElement; timing: TransitionTiming };

const fadeTiming = linearTiming({ durationInFrames: 30 });
const wipeTiming = linearTiming({ durationInFrames: 36 });

const fadeJoin: Join = { timing: fadeTiming, element: <TransitionSeries.Transition presentation={fade()} timing={fadeTiming} /> };
const wipeJoin: Join = {
  timing: wipeTiming,
  element: <TransitionSeries.Transition presentation={wipe({ direction: 'from-left' })} timing={wipeTiming} />,
};

/** The storyboard's three joins: cut, fade (30 frames) and one directional wipe (36 frames). */
export type TransitionName = 'cut' | 'fade' | 'wipe';

/** The join for a storyboard name. A cut has none. */
export const joinFor = (name: TransitionName): Join | null => {
  if (name === 'fade') return fadeJoin;
  if (name === 'wipe') return wipeJoin;
  return null;
};

/** Frames a join overlaps the two scenes it connects. A cut has none. */
export const overlapFrames = (name: TransitionName, fps: number) => joinFor(name)?.timing.getDurationInFrames({ fps }) ?? 0;

/** The element that goes between two `TransitionSeries.Sequence`s. A cut has none. */
export const joinElement = (name: TransitionName): ReactElement | null => joinFor(name)?.element ?? null;
