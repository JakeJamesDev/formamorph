// Material 3 easing-standard at duration-short4. Arbitrary `ease-[…]` also matches tailwindcss-animate's
// `ease-*`, so Tailwind drops it as ambiguous; the arbitrary property is generated.
const TIMING = 'duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';

/** How every collapsing strip moves once it animates, so none drifts from the others. */
export const SEGMENT_MOTION = {
  /** A segment's width and color. */
  segment: `transition-[width,color] ${TIMING}`,
  /** A label opening and closing. */
  label: `transition-[grid-template-columns,opacity,margin-left] ${TIMING}`,
  /** The pill's slide. */
  pill: `transition-[transform,width] ${TIMING}`,
} as const;
