// The reveal's per-word entrance animation is a set of independent, stackable effects (see
// RevealAnimationDemo): Fade (opacity), Move (translate), Scale (transform scale), Blur (filter).
// They live on orthogonal CSS properties, so any combination composes into a single keyframe
// (sd-reveal / sd-reveal-blur in index.css) driven by CSS vars — GPU-composited, no reflow. With no
// effect enabled the reveal falls back to the smooth character crawl.
export type RevealDirection = 'bottom' | 'top' | 'left' | 'right';
export type RevealScaleMode = 'uniform' | 'axis';

/** All the reveal-animation settings, resolved into one object (see SettingsContext.revealSpec). */
export interface RevealSpec {
  fade: boolean;
  move: boolean;
  moveDirection: RevealDirection;
  moveDistance: number; // em
  scale: boolean;
  scaleMode: RevealScaleMode; // uniform = grow, axis = stretch along one edge
  scaleDirection: RevealDirection; // anchored edge for axis mode
  scaleAmount: number; // start scale
  blur: boolean;
  blurAmount: number; // px
}

export const REVEAL_EASINGS = [
  { label: 'Ease out', value: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  { label: 'Ease in-out', value: 'ease-in-out' },
  { label: 'Linear', value: 'linear' },
  { label: 'Overshoot (bounce)', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  { label: 'Soft', value: 'ease' },
];

export const REVEAL_DIRECTIONS: { label: string; value: RevealDirection }[] = [
  { label: 'From bottom', value: 'bottom' },
  { label: 'From top', value: 'top' },
  { label: 'From left', value: 'left' },
  { label: 'From right', value: 'right' },
];

export const REVEAL_SCALE_MODES: { label: string; value: RevealScaleMode }[] = [
  { label: 'Uniform (grow)', value: 'uniform' },
  { label: 'One axis (stretch)', value: 'axis' },
];

export const DEFAULT_REVEAL_EASING = REVEAL_EASINGS[0].value;
export const DEFAULT_REVEAL_FADE = true; // preserves the prior fade-on default
export const DEFAULT_REVEAL_MOVE = false;
export const DEFAULT_REVEAL_MOVE_DIRECTION: RevealDirection = 'bottom';
export const DEFAULT_REVEAL_MOVE_DISTANCE = 0.5;
export const DEFAULT_REVEAL_SCALE = false;
export const DEFAULT_REVEAL_SCALE_MODE: RevealScaleMode = 'uniform';
export const DEFAULT_REVEAL_SCALE_DIRECTION: RevealDirection = 'bottom';
export const DEFAULT_REVEAL_SCALE_AMOUNT = 0.4;
export const DEFAULT_REVEAL_BLUR = false;
export const DEFAULT_REVEAL_BLUR_AMOUNT = 4;
// Preview display fallback when a minimum is "unlimited" (0), so the preview is still visible.
export const DEFAULT_PREVIEW_DURATION = 400;
export const DEFAULT_PREVIEW_STAGGER = 40;
// User minimums: the rate-derived reveal is floored to these so a fast model can't blow past a readable
// pace. 0 = no floor (unlimited). Shown user-facing as "Unlimited".
export const DEFAULT_REVEAL_MIN_DURATION = 0;
export const DEFAULT_REVEAL_MIN_STAGGER = 0;

/** Any effect enabled ⇒ animate the reveal; none ⇒ fall back to the smooth crawl. */
export const revealActive = (s: RevealSpec): boolean => s.fade || s.move || s.scale || s.blur;

/** The composed keyframe to use — the blur variant only when Blur is on, so words don't carry a
 *  filter layer for nothing. */
export const revealAnimName = (s: RevealSpec): string => (s.blur ? 'reveal-blur' : 'reveal');

const moveOffset = (direction: RevealDirection, dist: number): [number, number] => {
  const map: Record<RevealDirection, [number, number]> = {
    bottom: [0, dist], top: [0, -dist], left: [-dist, 0], right: [dist, 0],
  };
  return map[direction];
};

/** Container CSS vars feeding the composed reveal keyframe. Each enabled effect contributes its vars;
 *  unset vars sit at their identity (0 offset, scale 1, blur 0, opacity 1), so combinations compose. */
export function revealVars(s: RevealSpec): Record<string, string> {
  const vars: Record<string, string> = {};
  if (s.fade) vars['--rl-o'] = '0';
  if (s.move) {
    const [x, y] = moveOffset(s.moveDirection, s.moveDistance);
    vars['--rl-x'] = `${x}em`;
    vars['--rl-y'] = `${y}em`;
  }
  if (s.scale) {
    if (s.scaleMode === 'uniform') {
      vars['--rl-sx'] = String(s.scaleAmount);
      vars['--rl-sy'] = String(s.scaleAmount);
    } else {
      const vertical = s.scaleDirection === 'top' || s.scaleDirection === 'bottom';
      vars['--rl-sx'] = vertical ? '1' : String(s.scaleAmount);
      vars['--rl-sy'] = vertical ? String(s.scaleAmount) : '1';
      vars['--rl-origin'] = s.scaleDirection; // valid transform-origin keyword
    }
  }
  if (s.blur) vars['--rl-blur'] = `${s.blurAmount}px`;
  return vars;
}

// Word-cadence bounds (ms per word). The reveal matches the model's average word rate within these,
// so it keeps pace with generation; below the floor the buffer + end-of-turn drain absorb the lag,
// above the ceiling it just reveals as slowly as is still readable. The floor is low so a fast model
// (which easily exceeds 40 words/s) isn't throttled into a reveal that drags on long after generation.
export const STAGGER_MIN = 8;
export const STAGGER_MAX = 90;
// Per-word fade length as a multiple of the cadence — keeps a roughly constant number of words
// mid-fade at any speed (fast streams fade quick-and-tight, slow ones linger). 10 ≈ the hand-tuned
// 400ms fade at the 40ms default cadence.
export const FADE_SPREAD = 10;

export const DEFAULT_STAGGER = 40;
export const DEFAULT_DURATION = DEFAULT_STAGGER * FADE_SPREAD;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Fade timing for a smoothed word rate (words/sec): cadence tracks the rate (clamped readable),
 *  fade length scales with the cadence. */
export function timingForWordRate(wordsPerSec: number): { duration: number; stagger: number } {
  const stagger = clamp(1000 / wordsPerSec, STAGGER_MIN, STAGGER_MAX);
  return { stagger, duration: stagger * FADE_SPREAD };
}

/** Apply the user's minimum floors to a rate-derived timing (0 = no floor): stagger can't drop below
 *  `minStagger`, and duration can't drop below `minDuration` (re-derived from the floored stagger so
 *  the fade keeps a sensible spread). Lets a fast model be pinned to a readable minimum pace. */
export function flooredTiming(
  t: { duration: number; stagger: number },
  minStagger: number,
  minDuration: number,
): { duration: number; stagger: number } {
  const stagger = Math.max(t.stagger, minStagger);
  return { stagger, duration: Math.max(stagger * FADE_SPREAD, minDuration) };
}
