// The reveal's per-word entrance animation is a set of independent, stackable effects (see
// RevealAnimationDemo): Fade (opacity), Move (translate), Scale (transform scale), Blur (filter).
// They live on orthogonal CSS properties, so any combination composes into a single keyframe
// (sd-reveal / sd-reveal-blur in index.css) driven by CSS vars — GPU-composited, no reflow. With no
// effect enabled the reveal falls back to the smooth character crawl.
import { clamp } from './utils';

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

// Word-cadence bounds (ms per word), a readability clamp on the measured pace: a giant arrival gap
// can't drag the reveal to a crawl, and a burst can't drive it below a legible speed. 300ms ≈ 3.3 w/s.
export const STAGGER_MIN = 8;
export const STAGGER_MAX = 300;
// Per-word fade length as a multiple of the cadence — keeps a roughly constant number of words
// mid-fade at any speed (fast streams fade quick-and-tight, slow ones linger). Kept small on purpose:
// Streamdown re-renders old words with duration 0 on every release, so any word still mid-fade at a
// sentence boundary SNAPS to full opacity — the smaller the spread, the fewer words are ever mid-fade
// when that happens (at 4, the fade is mostly done within the sentence's own rhythm span).
export const FADE_SPREAD = 4;

export const DEFAULT_STAGGER = 40;
export const DEFAULT_DURATION = DEFAULT_STAGGER * FADE_SPREAD;

// Arrival-measurement pacing (see useSentenceReveal). The reveal doesn't estimate tokens/sec — it
// measures the wall-clock gap between sentence arrivals and reveals at that rate, holding a small
// backlog buffer so it never runs dry (stutter) nor lags far behind (trail):
//  - A rate sample is only trusted when its gap is real; sub-threshold gaps are the server's token
//    burst (many sentences at once) and would read as infinitely fast, so they're ignored.
export const ARRIVAL_MIN_GAP_MS = 30;
//  - The measured ms/word is smoothed (EMA) so one jittery gap doesn't jerk the pace.
export const ARRIVAL_EMA_ALPHA = 0.35;
//  - The controller targets this backlog (words already arrived but not yet revealed). Above it the
//    reveal speeds up to drain; below it, slows to let the buffer refill — converging on the target.
//    It MUST exceed the longest sentence: the equilibrium backlog is this value, and lumpy sentence-
//    sized arrivals swing it by ±(a sentence), so a target under one sentence lets the buffer hit zero
//    between arrivals — a starve/stutter every sentence. ~2 sentences keeps it comfortably above empty.
export const TARGET_BUFFER_WORDS = 30;
//  - Once arrival is over there's no starving, so drain toward near-empty (this smaller target) rather
//    than holding the big buffer — keeps the post-generation tail short.
export const DRAIN_TARGET_WORDS = 4;
//  - Bounds on that speed-up/slow-down so the controller stays gentle and never stalls or sprints.
export const PACE_CORRECTION_MIN = 0.5;
export const PACE_CORRECTION_MAX = 2;

export { clamp }; // re-exported (from ./utils) so existing importers/tests keep their path

/** Apply the user's minimum floors to a timing (0 = no floor): stagger can't drop below `minStagger`,
 *  and duration can't drop below `minDuration` (re-derived from the floored stagger so the fade keeps
 *  a sensible spread). Lets a fast model be pinned to a readable minimum pace. */
export function flooredTiming(
  t: { duration: number; stagger: number },
  minStagger: number,
  minDuration: number,
): { duration: number; stagger: number } {
  const stagger = Math.max(t.stagger, minStagger);
  return { stagger, duration: Math.max(stagger * FADE_SPREAD, minDuration) };
}

/** The reveal cadence (ms/word) for the given measured arrival rate and current backlog: the measured
 *  ms/word, nudged toward holding a target backlog — faster when the backlog is over target, slower when
 *  under — then clamped to the readable bounds. While streaming, the target is `TARGET_BUFFER_WORDS` (a
 *  cushion against starving). Once `drainingOnly` (arrival finished), it targets the much smaller
 *  `DRAIN_TARGET_WORDS` and never slows below the measured rate, so the tail empties promptly. */
export function pacedStagger(msPerWord: number, backlogWords: number, drainingOnly: boolean): number {
  const target = drainingOnly ? DRAIN_TARGET_WORDS : TARGET_BUFFER_WORDS;
  let correction = clamp(target / Math.max(backlogWords, 1), PACE_CORRECTION_MIN, PACE_CORRECTION_MAX);
  if (drainingOnly) correction = Math.min(correction, 1);
  return clamp(msPerWord * correction, STAGGER_MIN, STAGGER_MAX);
}
