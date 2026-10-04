/**
 * How the Mascot moves on a face change, as one pure timing function: elapsed time and the rig's transition
 * in, a scale per axis and the new look's opacity out. The window, the tab preview and the tests share it.
 */
import { isRecord } from '@/lib/tools/toolValidation';

export const MASCOT_TRANSITION_MODES = ['none', 'dissolve', 'jelly'] as const;
export type MascotTransitionMode = (typeof MASCOT_TRANSITION_MODES)[number];

export interface JellyTuning {
  /** The whole transition, in milliseconds. */
  readonly durationMs: number;
  /** How far below normal the height dips: 0.2 is a dip to 80%. */
  readonly squash: number;
  /** How far past normal the height stretches on the first swing: 0.1 is a peak at 110%. */
  readonly overshoot: number;
  /** Swings after the overshoot before rest. 0 goes from the overshoot straight to rest. */
  readonly settle: number;
}

export interface DissolveTuning {
  /** The cross-fade, in milliseconds. */
  readonly durationMs: number;
}

/** The mode and the tuning of every mode, so a mode switch loses no tuning. */
export interface MascotTransition {
  readonly mode: MascotTransitionMode;
  readonly jelly: JellyTuning;
  readonly dissolve: DissolveTuning;
}

export interface MascotTransitionFrame {
  readonly scaleX: number;
  readonly scaleY: number;
  /** The new look's opacity over the old one. */
  readonly opacity: number;
  /** True once the new look draws. */
  readonly swapped: boolean;
  /** True at and past the duration. */
  readonly done: boolean;
}

export interface TuningRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const DURATION_RANGE: TuningRange = { min: 150, max: 1200, step: 10 };

/** The tab's slider bounds. */
export const JELLY_RANGES: { readonly [K in keyof JellyTuning]: TuningRange } = {
  durationMs: DURATION_RANGE,
  squash: { min: 0, max: 0.5, step: 0.01 },
  overshoot: { min: 0, max: 0.5, step: 0.01 },
  settle: { min: 0, max: 4, step: 1 },
};

export const DISSOLVE_RANGES: { readonly [K in keyof DissolveTuning]: TuningRange } = { durationMs: DURATION_RANGE };

export const DEFAULT_MASCOT_TRANSITION: MascotTransition = {
  mode: 'jelly',
  jelly: { durationMs: 450, squash: 0.18, overshoot: 0.12, settle: 2 },
  dissolve: { durationMs: 250 },
};

/** The width moves against the height by this share of the height offset, so the mascot keeps a sense of volume. */
export const JELLY_WIDTH_COUPLING = 0.5;

/** The last settle swing's amplitude as a share of the overshoot. */
const TAIL = 0.05;

/** The half-cycles before the settle swings: the squash in, the swing to the overshoot, and the last quarter to rest. */
const BASE_HALF_CYCLES = 2.5;

const REST: MascotTransitionFrame = { scaleX: 1, scaleY: 1, opacity: 1, swapped: true, done: true };

const jellyHalfCycles = (tuning: JellyTuning): number => BASE_HALF_CYCLES + tuning.settle;

/** When the dip lands and the look swaps, in milliseconds from the start. */
export const jellyDipMs = (tuning: JellyTuning): number => tuning.durationMs / jellyHalfCycles(tuning);

const halfSwing = (u: number): number => (1 - Math.cos(Math.PI * u)) / 2;

/** The height offset from normal over the normalized time: from `from` down to -squash, up to +overshoot, then damped to rest. */
function heightOffset(t: number, tuning: JellyTuning, from: number): number {
  if (t >= 1) return 0;
  const { squash, overshoot, settle } = tuning;
  const phase = t * jellyHalfCycles(tuning);
  if (phase < 1) return from + (-squash - from) * halfSwing(phase);
  if (phase < 2) return -squash + (squash + overshoot) * halfSwing(phase - 1);
  const v = phase - 2;
  const decay = settle > 0 ? Math.log(1 / TAIL) / settle : 0;
  return overshoot * Math.exp(-decay * v) * Math.cos(Math.PI * v);
}

const progress = (elapsedMs: number, durationMs: number): number => Math.min(Math.max(elapsedMs / durationMs, 0), 1);

/**
 * The frame at `elapsedMs` into a face change. `fromHeight` is the height the mascot has when the run starts,
 * so a change that interrupts a Jelly run eases on from where it was. Past the duration it is the rest frame.
 */
export function mascotTransitionAt(elapsedMs: number, transition: MascotTransition, fromHeight = 1): MascotTransitionFrame {
  if (transition.mode === 'none') return REST;
  if (transition.mode === 'dissolve') {
    const t = progress(elapsedMs, transition.dissolve.durationMs);
    if (t >= 1) return REST;
    // A height left by an interrupted Jelly eases back to full over the fade.
    const offset = (fromHeight - 1) * (1 - halfSwing(t));
    return { scaleX: 1 - offset * JELLY_WIDTH_COUPLING, scaleY: 1 + offset, opacity: halfSwing(t), swapped: true, done: false };
  }
  const tuning = transition.jelly;
  const t = progress(elapsedMs, tuning.durationMs);
  if (t >= 1) return REST;
  const offset = heightOffset(t, tuning, fromHeight - 1);
  return {
    scaleX: 1 - offset * JELLY_WIDTH_COUPLING,
    scaleY: 1 + offset,
    opacity: 1,
    swapped: elapsedMs >= jellyDipMs(tuning),
    done: false,
  };
}

const isMode = (value: unknown): value is MascotTransitionMode => (MASCOT_TRANSITION_MODES as readonly unknown[]).includes(value);

/** A stored number held within its range and on its step; the fallback when it is not a number. */
function parseTuning(stored: unknown, range: TuningRange, fallback: number): number {
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return fallback;
  const held = Math.min(Math.max(stored, range.min), range.max);
  const steps = Math.round((held - range.min) / range.step);
  // Rounded to the step's decimals, which drops float noise from the multiply.
  const decimals = (String(range.step).split('.')[1] ?? '').length;
  return Number((range.min + steps * range.step).toFixed(decimals));
}

const asRecord = (stored: unknown): Record<string, unknown> => (isRecord(stored) ? stored : {});

/** A stored transition, read field by field; a missing or bad field takes the default's. One with no tuning at all reads as the default. */
export function parseMascotTransition(stored: unknown): MascotTransition {
  const record = asRecord(stored);
  if (!isRecord(record.jelly) && !isRecord(record.dissolve)) return DEFAULT_MASCOT_TRANSITION;
  const jelly = asRecord(record.jelly);
  const dissolve = asRecord(record.dissolve);
  const fallback = DEFAULT_MASCOT_TRANSITION;
  return {
    mode: isMode(record.mode) ? record.mode : fallback.mode,
    jelly: {
      durationMs: parseTuning(jelly.durationMs, JELLY_RANGES.durationMs, fallback.jelly.durationMs),
      squash: parseTuning(jelly.squash, JELLY_RANGES.squash, fallback.jelly.squash),
      overshoot: parseTuning(jelly.overshoot, JELLY_RANGES.overshoot, fallback.jelly.overshoot),
      settle: parseTuning(jelly.settle, JELLY_RANGES.settle, fallback.jelly.settle),
    },
    dissolve: { durationMs: parseTuning(dissolve.durationMs, DISSOLVE_RANGES.durationMs, fallback.dissolve.durationMs) },
  };
}
