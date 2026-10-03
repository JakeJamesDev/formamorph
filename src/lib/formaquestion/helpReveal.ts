/**
 * How a help answer reveals. Help keeps its own values and its own timing, so the Answer Reveal and
 * Narration Reveal settings never change each other, and a help answer never writes the game's timing.
 */
import {
  DEFAULT_DURATION, DEFAULT_REVEAL_BLUR, DEFAULT_REVEAL_BLUR_AMOUNT, DEFAULT_REVEAL_EASING, DEFAULT_REVEAL_FADE,
  DEFAULT_REVEAL_MIN_DURATION, DEFAULT_REVEAL_MIN_STAGGER, DEFAULT_REVEAL_MOVE, DEFAULT_REVEAL_MOVE_DIRECTION,
  DEFAULT_REVEAL_MOVE_DISTANCE, DEFAULT_REVEAL_SCALE, DEFAULT_REVEAL_SCALE_AMOUNT, DEFAULT_REVEAL_SCALE_DIRECTION,
  DEFAULT_REVEAL_SCALE_MODE, DEFAULT_STAGGER, REVEAL_DIRECTIONS, REVEAL_EASINGS, REVEAL_RANGES, REVEAL_SCALE_MODES,
  flooredTiming, reducedMotionSpec, type RevealSpec, type RevealTiming,
} from '@/lib/narrationRevealConfig';

/** The effects of the answer reveal, its easing, and its minimum speed in ms. */
export interface HelpReveal extends RevealSpec {
  readonly easing: string;
  readonly minDuration: number;
  readonly minStagger: number;
}

/** Narration's defaults. Help never reads narration's stored values. */
export const DEFAULT_HELP_REVEAL: HelpReveal = {
  fade: DEFAULT_REVEAL_FADE,
  move: DEFAULT_REVEAL_MOVE,
  moveDirection: DEFAULT_REVEAL_MOVE_DIRECTION,
  moveDistance: DEFAULT_REVEAL_MOVE_DISTANCE,
  scale: DEFAULT_REVEAL_SCALE,
  scaleMode: DEFAULT_REVEAL_SCALE_MODE,
  scaleDirection: DEFAULT_REVEAL_SCALE_DIRECTION,
  scaleAmount: DEFAULT_REVEAL_SCALE_AMOUNT,
  blur: DEFAULT_REVEAL_BLUR,
  blurAmount: DEFAULT_REVEAL_BLUR_AMOUNT,
  easing: DEFAULT_REVEAL_EASING,
  minDuration: DEFAULT_REVEAL_MIN_DURATION,
  minStagger: DEFAULT_REVEAL_MIN_STAGGER,
};

type Check = (value: unknown) => boolean;
const isBool: Check = (value) => typeof value === 'boolean';
const isOneOf = (options: readonly { value: string }[]): Check => (value) => options.some((option) => option.value === value);
const isIn = ({ min, max }: { min: number; max: number }): Check => (value) => typeof value === 'number' && value >= min && value <= max;
const isIntIn = (range: { min: number; max: number }): Check => (value) => Number.isInteger(value) && isIn(range)(value);

const CHECKS: { [K in keyof HelpReveal]: Check } = {
  fade: isBool,
  move: isBool,
  moveDirection: isOneOf(REVEAL_DIRECTIONS),
  moveDistance: isIn(REVEAL_RANGES.moveDistance),
  scale: isBool,
  scaleMode: isOneOf(REVEAL_SCALE_MODES),
  scaleDirection: isOneOf(REVEAL_DIRECTIONS),
  scaleAmount: isIn(REVEAL_RANGES.scaleAmount),
  blur: isBool,
  blurAmount: isIntIn(REVEAL_RANGES.blurAmount),
  easing: isOneOf(REVEAL_EASINGS),
  minDuration: isIntIn(REVEAL_RANGES.minDuration),
  minStagger: isIntIn(REVEAL_RANGES.minStagger),
};

/** The stored values; a bad field takes its default, and a value that is not an object takes all of them. */
export function parseHelpReveal(stored: unknown): HelpReveal {
  const record = typeof stored === 'object' && stored !== null && !Array.isArray(stored) ? stored as Record<string, unknown> : {};
  const entries = Object.entries(CHECKS).map(([key, check]) =>
    [key, check(record[key]) ? record[key] : DEFAULT_HELP_REVEAL[key as keyof HelpReveal]]);
  // Every key of CHECKS holds a value that passed its check or the default, so the record is whole.
  return Object.fromEntries(entries) as unknown as HelpReveal;
}

/** The effects an answer draws with, under the OS reduced-motion setting. */
export const helpRevealSpec = (reveal: HelpReveal, reduceMotion: boolean): RevealSpec =>
  reducedMotionSpec(reveal, reduceMotion);

/** The word timing of an answer: the default pace, never faster than help's floors. */
export const helpRevealTiming = (reveal: HelpReveal): RevealTiming =>
  flooredTiming({ stagger: DEFAULT_STAGGER, duration: DEFAULT_DURATION }, reveal.minStagger, reveal.minDuration);
