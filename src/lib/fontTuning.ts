/**
 * Per-font tuning: the Customize dialog beside each font selector. Fonts differ in how they render
 * weight, slant and rhythm, so each font value carries its own set of tunings — shipped defaults from the
 * font registry, overridden by whatever the player saved for that font.
 *
 * Everything here is pure: the settings context owns the stored map and writes the CSS variables this
 * module computes, and only the document root ever reads them.
 */
import { FONT_OPTIONS, fontShippedTuning, fontWeightMax, type FontChoice } from '@/contexts/settingsDefaults';

/** One font's tunings. Scale, line height and letter spacing are multipliers/offsets on the app's
 *  normalized baseline, so every value at its base is a true no-op. */
export interface FontTuning {
  /** Multiplies the font's x-height target, so it rides the size normalization instead of root size. */
  scale: number;
  /** The weight semibold renders at; bold rides `BOLD_OFFSET` above it, capped by the font's axis. */
  boldWeight: number;
  /** Extra slant in degrees applied on top of the real italic face. 0 = the face alone. */
  italicSkew: number;
  /** Multiplies the line height of every type role. */
  lineHeight: number;
  /** Tracking in em, added to the font's natural spacing. */
  letterSpacing: number;
}

/** The untuned baseline: 600/700 is the app's stock semibold/bold pair, the rest are identities. */
export const FONT_TUNING_BASE: FontTuning = {
  scale: 1,
  boldWeight: 600,
  italicSkew: 0,
  lineHeight: 1,
  letterSpacing: 0,
};

/** How far bold sits above semibold, before the font's axis maximum caps it. */
export const BOLD_OFFSET = 100;

/** Slider bounds per field. `boldWeight`'s maximum is per-font — see `boldWeightRange`; its floor is the
 *  app's stock semibold, so raising bold can never invert the type hierarchy by going lighter than body. */
export const FONT_TUNING_RANGES = {
  scale: { min: 0.7, max: 1.5, step: 0.1 },
  boldWeight: { min: 600, max: 1000, step: 25 },
  italicSkew: { min: 0, max: 15, step: 0.5 },
  lineHeight: { min: 0.8, max: 1.4, step: 0.05 },
  letterSpacing: { min: -0.05, max: 0.15, step: 0.005 },
} as const;

/** The bold-weight slider's bounds for a font: capped at the heaviest weight its face can render. */
export function boldWeightRange(font: FontChoice) {
  return { ...FONT_TUNING_RANGES.boldWeight, max: Math.min(FONT_TUNING_RANGES.boldWeight.max, fontWeightMax(font)) };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Clamp every field into range, dropping non-finite values back to the given fallback. */
function clampTuning(t: FontTuning, font: FontChoice): FontTuning {
  const num = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
  const r = FONT_TUNING_RANGES;
  return {
    scale: clamp(num(t.scale, FONT_TUNING_BASE.scale), r.scale.min, r.scale.max),
    boldWeight: clamp(num(t.boldWeight, FONT_TUNING_BASE.boldWeight), r.boldWeight.min, boldWeightRange(font).max),
    italicSkew: clamp(num(t.italicSkew, FONT_TUNING_BASE.italicSkew), r.italicSkew.min, r.italicSkew.max),
    lineHeight: clamp(num(t.lineHeight, FONT_TUNING_BASE.lineHeight), r.lineHeight.min, r.lineHeight.max),
    letterSpacing: clamp(num(t.letterSpacing, FONT_TUNING_BASE.letterSpacing), r.letterSpacing.min, r.letterSpacing.max),
  };
}

/** A font's shipped tuning: the baseline plus its registry overrides. What Reset returns to. */
export function fontTuningDefaults(font: FontChoice): FontTuning {
  return clampTuning({ ...FONT_TUNING_BASE, ...fontShippedTuning(font) }, font);
}

/** The tuning in force for a font: its shipped defaults with the player's saved overrides on top. */
export function resolveFontTuning(font: FontChoice, stored: FontTuningMap): FontTuning {
  return clampTuning({ ...fontTuningDefaults(font), ...stored[font] }, font);
}

/** The bold weight paired with a tuning's semibold, capped by the font's axis. */
export function boldWeightFor(font: FontChoice, tuning: FontTuning): number {
  return Math.min(tuning.boldWeight + BOLD_OFFSET, fontWeightMax(font));
}

/** True when a tuning equals the font's shipped defaults, i.e. Reset would change nothing. */
export function isFontTuningDefault(font: FontChoice, tuning: FontTuning): boolean {
  const d = fontTuningDefaults(font);
  return (Object.keys(d) as (keyof FontTuning)[]).every((k) => d[k] === tuning[k]);
}

/** Saved tunings, keyed by font value (`system` included). Absent key ⇒ the font's shipped defaults. */
export type FontTuningMap = Partial<Record<FontChoice, Partial<FontTuning>>>;

// Derived, so a new tuning field can't be added to the shape and forgotten here.
const TUNING_KEYS = Object.keys(FONT_TUNING_BASE) as (keyof FontTuning)[];

/** Keep only the fields that differ from the font's shipped defaults, so a stored entry stays a diff and
 *  a later change to the shipped tuning still reaches players who never touched that field. */
export function diffFromDefaults(font: FontChoice, tuning: FontTuning): Partial<FontTuning> {
  const d = fontTuningDefaults(font);
  const out: Partial<FontTuning> = {};
  for (const k of TUNING_KEYS) if (tuning[k] !== d[k]) out[k] = tuning[k];
  return out;
}

/** Store a font's tunings, dropping the entry entirely when it matches the shipped defaults. */
export function withFontTuning(map: FontTuningMap, font: FontChoice, tuning: FontTuning): FontTuningMap {
  const diff = diffFromDefaults(font, tuning);
  const next = { ...map };
  if (Object.keys(diff).length === 0) delete next[font];
  else next[font] = diff;
  return next;
}

/** Drop anything that isn't a known field holding a finite number; a wholly invalid entry disappears. */
function sanitizeEntry(raw: unknown): Partial<FontTuning> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: Partial<FontTuning> = {};
  for (const k of TUNING_KEYS) {
    const v = src[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** localStorage codec for the whole map. A malformed blob throws so the caller falls back to `{}`,
 *  matching how every other setting treats a corrupt stored value. */
export const fontTuningMapCodec = {
  parse: (raw: string): FontTuningMap => {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a tuning map');
    const out: FontTuningMap = {};
    for (const [font, entry] of Object.entries(parsed as Record<string, unknown>)) {
      // A key that isn't a font we ship (a renamed or removed one) is dropped rather than carried.
      if (!FONT_OPTIONS.some((f) => f.value === font)) continue;
      const clean = sanitizeEntry(entry);
      if (clean) out[font as FontChoice] = clean;
    }
    return out;
  },
  serialize: (v: FontTuningMap) => JSON.stringify(v),
};

/** The CSS variables a resolved tuning contributes, under a prefix so the narration pane can carry its
 *  own set alongside the app-wide one. Values are strings, ready for `style.setProperty`. */
export function fontTuningVars(font: FontChoice, tuning: FontTuning, prefix: string): Record<string, string> {
  return {
    [`${prefix}weight-semibold`]: String(tuning.boldWeight),
    [`${prefix}weight-bold`]: String(boldWeightFor(font, tuning)),
    [`${prefix}italic-skew`]: `${tuning.italicSkew}deg`,
    [`${prefix}line-height`]: String(tuning.lineHeight),
    [`${prefix}letter-spacing`]: `${tuning.letterSpacing}em`,
  };
}

/** The app-wide variable prefix; the narration pane maps its own set onto these. */
export const APP_TUNING_PREFIX = '--fm-';
/** The narration pane's variable prefix (see `.narration-text` in index.css). */
export const NARRATION_TUNING_PREFIX = '--narration-fm-';
