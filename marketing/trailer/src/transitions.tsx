import { TransitionSeries, linearTiming, type TransitionTiming } from '@remotion/transitions';
import { none } from '@remotion/transitions/none';
import type { ReactElement } from 'react';

/** A join between two scenes: the element that goes between their `TransitionSeries.Sequence`s, and how long it overlaps them. */
export type Join = { element: ReactElement; timing: TransitionTiming };

/** The leaving scene stacks on top, so its fading caption never sits behind the next card. */
const exitOnTop = none({ exitStyle: { zIndex: 1 } });

/** Ruling Q29: a join is a plain overlap. The outgoing scene leaves by its own exit while the next one springs in over the same stage. */
const overlapJoin = (durationInFrames: number): Join => {
  const timing = linearTiming({ durationInFrames });
  return { timing, element: <TransitionSeries.Transition presentation={exitOnTop} timing={timing} /> };
};

/** The storyboard's three joins: `cut` (no overlap), `overlap` (30 frames, inside a section) and `section` (36 frames, between sections). */
export type TransitionName = 'cut' | 'overlap' | 'section';

const JOINS: Record<TransitionName, Join | null> = { cut: null, overlap: overlapJoin(30), section: overlapJoin(36) };

/** The join for a storyboard name. A cut has none. */
export const joinFor = (name: TransitionName): Join | null => JOINS[name];

/** Frames a join overlaps the two scenes it connects. A cut has none. */
export const overlapFrames = (name: TransitionName, fps: number) => joinFor(name)?.timing.getDurationInFrames({ fps }) ?? 0;

/** The element that goes between two `TransitionSeries.Sequence`s. A cut has none. */
export const joinElement = (name: TransitionName): ReactElement | null => joinFor(name)?.element ?? null;
