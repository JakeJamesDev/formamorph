// The reveal's per-word entrance animation is user-selectable (see RevealAnimationDemo). Each option
// maps to a `sd-<anim>` keyframe (in index.css / shipped by Streamdown) built from opacity + transform
// so it stays GPU-composited. `none` skips the animation entirely and uses the smooth character crawl.
export type RevealAnimation = 'none' | 'fade' | 'move' | 'grow' | 'stretch' | 'blur' | 'slide';
export type RevealDirection = 'bottom' | 'top' | 'left' | 'right';

export interface RevealAnimOption {
  key: RevealAnimation;
  label: string;
  anim: string | null; // Streamdown `animation` name (→ sd-<anim> keyframe); null = no per-word animation
  amount: 'none' | 'distance' | 'scale';
  directional?: boolean;
}

export const REVEAL_ANIMATIONS: RevealAnimOption[] = [
  { key: 'none', label: 'None (smooth crawl)', anim: null, amount: 'none' },
  { key: 'fade', label: 'Fade', anim: 'fadeIn', amount: 'none' },
  { key: 'move', label: 'Move in', anim: 'moveIn', amount: 'distance', directional: true },
  { key: 'grow', label: 'Grow', anim: 'growIn', amount: 'scale' },
  { key: 'stretch', label: 'Stretch', anim: 'stretchIn', amount: 'scale', directional: true },
  { key: 'blur', label: 'Blur', anim: 'blurIn', amount: 'none' },
  { key: 'slide', label: 'Slide up', anim: 'slideUp', amount: 'none' },
];

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

export const DEFAULT_REVEAL_ANIMATION: RevealAnimation = 'fade';
export const DEFAULT_REVEAL_EASING = REVEAL_EASINGS[0].value;
export const DEFAULT_REVEAL_DIRECTION: RevealDirection = 'bottom';
export const DEFAULT_REVEAL_DISTANCE = 0.5; // em, for Move
export const DEFAULT_REVEAL_SCALE = 0.4; // start scale, for Grow / Stretch
// Preview-only defaults (in game these come from the model's rate, see timingForWordRate).
export const DEFAULT_PREVIEW_DURATION = 400;
export const DEFAULT_PREVIEW_STAGGER = 40;

export const revealOption = (key: string): RevealAnimOption =>
  REVEAL_ANIMATIONS.find((a) => a.key === key) ?? REVEAL_ANIMATIONS[1];

/** Streamdown `animation` name for a reveal key, or null for the no-animation (smooth crawl) mode. */
export const revealAnimName = (key: string): string | null => revealOption(key).anim;

/** Start-offset CSS vars for sd-moveIn given a direction + distance (em). */
export function moveVars(direction: RevealDirection, distanceEm: number): Record<string, string> {
  const map: Record<RevealDirection, [number, number]> = {
    bottom: [0, distanceEm],
    top: [0, -distanceEm],
    left: [-distanceEm, 0],
    right: [distanceEm, 0],
  };
  const [x, y] = map[direction];
  return { '--rl-x': `${x}em`, '--rl-y': `${y}em` };
}

/** Start-scale + anchored-edge CSS vars for sd-stretchIn: scales along one axis, growing from the
 *  named edge (left/right → horizontal, top/bottom → vertical). */
export function stretchVars(direction: RevealDirection, startScale: number): Record<string, string> {
  const s = String(startScale);
  const vertical = direction === 'top' || direction === 'bottom';
  return {
    '--rl-sx': vertical ? '1' : s,
    '--rl-sy': vertical ? s : '1',
    '--rl-origin': direction, // 'left' | 'right' | 'top' | 'bottom' are valid transform-origin keywords
  };
}

/** Container CSS vars feeding the current reveal keyframe (Move offset / Stretch axis / Grow scale). */
export function revealVars(
  key: string,
  direction: RevealDirection,
  distanceEm: number,
  startScale: number,
): Record<string, string> {
  const opt = revealOption(key);
  if (opt.key === 'move') return moveVars(direction, distanceEm);
  if (opt.key === 'stretch') return stretchVars(direction, startScale);
  if (opt.amount === 'scale') return { '--rl-scale': String(startScale) }; // grow (uniform)
  return {};
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
