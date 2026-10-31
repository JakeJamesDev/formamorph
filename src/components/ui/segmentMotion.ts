import { createContext } from 'react';

/** How a collapsing strip moves once it animates. Every strip reads one of these, so none drifts. */
export interface SegmentMotion {
  /** Classes on each segment's width and color. */
  segment: string;
  /** Classes on a label opening and closing. */
  label: string;
  /** Classes on the pill's slide, or a stretch that moves the pill's leading edge before its trailing one. */
  pill: string | { stretch: { ms: number; lagMs: number; easing: string } };
}

// Arbitrary `ease-[…]` also matches tailwindcss-animate's `ease-*`, so Tailwind drops it as ambiguous.
const EASE = 'duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';
const SPRING = 'duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none';

/** The candidates the dev trial compares. */
export const SEGMENT_MOTIONS = {
  baseline: {
    segment: `transition-[width,color] ${EASE}`,
    label: `transition-[grid-template-columns,opacity,margin-left] ${EASE}`,
    pill: `transition-[transform,width] ${EASE}`,
  },
  stretch: {
    segment: `transition-[width,color] ${EASE}`,
    label: `transition-[grid-template-columns,opacity,margin-left] ${EASE}`,
    pill: { stretch: { ms: 180, lagMs: 90, easing: 'cubic-bezier(0.2,0,0,1)' } },
  },
  spring: {
    segment: `transition-[width,color] ${SPRING}`,
    label: `transition-[grid-template-columns,opacity,margin-left] ${SPRING}`,
    pill: `transition-[transform,width] ${SPRING}`,
  },
  fade: {
    segment: 'transition-[color] duration-200 ease-out motion-reduce:transition-none',
    label: 'transition-[opacity] duration-200 ease-out motion-reduce:transition-none',
    pill: '',
  },
} satisfies Record<string, SegmentMotion>;

export type SegmentMotionName = keyof typeof SEGMENT_MOTIONS;

/** The motion every strip uses unless the dev trial provides another. */
export const SegmentMotionContext = createContext<SegmentMotion>(SEGMENT_MOTIONS.baseline);
