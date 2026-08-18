import type { Stat, StatDescriptor, ThresholdUnit } from '@/types';

/**
 * Descriptor geometry: where each band actually starts and stops on a stat's min→max scale, what the
 * range above the top band leaves uncovered, and how a threshold reads in whichever unit its stat uses.
 *
 * Thresholds are raw stat values unless the stat opts into `percent`, in which case the stored number is a
 * share of min→max. Everything that needs to draw, describe or convert a band reads from here, so the
 * editor's coverage bar, the Bench's rules and the band lookup can never disagree about what a number means.
 */

/** The fields geometry needs. Loose enough for an editor draft (`Partial<Stat>`), satisfied by `Stat`,
 *  `PlayerStat` and the Bench's own stat view-models. */
export interface BandedStat {
  min?: number;
  max?: number;
  type?: Stat['type'];
  thresholdUnit?: ThresholdUnit;
  descriptors?: StatDescriptor[];
  starting?: number;
  value?: number;
}

/** One descriptor's real extent: it covers `from` (exclusive, except the first band) up to `to`. */
export interface BandSpan {
  id: StatDescriptor['id'];
  description: string;
  /** The stored number, in the stat's threshold unit. */
  threshold: number;
  /** Raw stat values, rounded for display. */
  from: number;
  to: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const statMin = (stat: BandedStat): number => stat.min ?? 0;
export const statMax = (stat: BandedStat): number => stat.max ?? 100;

/** Which unit this stat's thresholds are in. A Percentage stat is pinned to 0–100, where the two readings
 *  are the same number, so it is always percent and never carries a choice. */
export function thresholdUnitOf(stat: BandedStat): ThresholdUnit {
  if (stat.type?.toLowerCase() === 'percentage') return 'percent';
  return stat.thresholdUnit === 'percent' ? 'percent' : 'raw';
}

/** The raw stat value a stored threshold sits at. Exact — callers round for display. */
export function thresholdValue(stat: BandedStat, threshold: number): number {
  if (thresholdUnitOf(stat) === 'raw') return threshold;
  const min = statMin(stat);
  return min + (threshold / 100) * (statMax(stat) - min);
}

/** The stored threshold that would put a band at this raw value — the inverse of `thresholdValue`. A
 *  degenerate range has no proportion to express, so every value reads as 0%. */
export function valueThreshold(stat: BandedStat, value: number): number {
  if (thresholdUnitOf(stat) === 'raw') return round2(value);
  const min = statMin(stat);
  const range = statMax(stat) - min;
  return range === 0 ? 0 : round2(((value - min) / range) * 100);
}

/** The descriptors ascending by threshold; stable, so equal thresholds keep authored order (which is what
 *  makes the second one of a pair unreachable rather than random). */
export function sortedDescriptors(stat: BandedStat): StatDescriptor[] {
  return [...(stat.descriptors ?? [])].sort((a, b) => a.threshold - b.threshold);
}

/** Every band's extent, ascending: the first starts at min, each later one at the band below it. */
export function descriptorSpans(stat: BandedStat): BandSpan[] {
  let from = statMin(stat);
  return sortedDescriptors(stat).map((descriptor) => {
    const to = round2(thresholdValue(stat, descriptor.threshold));
    const span: BandSpan = { id: descriptor.id, description: descriptor.description, threshold: descriptor.threshold, from, to };
    from = to;
    return span;
  });
}

/** The range above the top band, where the AI is told no status at all — null when the bands reach max
 *  (or when there are no bands, which is a stat with nothing to say rather than a gap). */
export function uncoveredSpan(stat: BandedStat): { from: number; to: number } | null {
  const spans = descriptorSpans(stat);
  const top = spans[spans.length - 1];
  const max = statMax(stat);
  if (!top || top.to >= max) return null;
  return { from: top.to, to: max };
}

/** The stat's value at the top of turn one, resolved exactly as the seeder resolves it (lib/statBackfill):
 *  the authored start, else any live value, else the floor. */
export function statStartValue(stat: BandedStat): number {
  if (typeof stat.starting === 'number') return stat.starting;
  if (typeof stat.value === 'number') return stat.value;
  return statMin(stat);
}

/** Five digits is where an exact ceiling starts crowding out the value beside it. */
const COMPACT_TAG_FLOOR = 10000;
const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** The tag every threshold input wears: `%` for percent thresholds, `of <max>` for raw ones — compacted
 *  (`of 101k`) once the ceiling reaches five digits; the exact number stays in the row's covers caption. */
export function thresholdUnitTag(stat: BandedStat): string {
  if (thresholdUnitOf(stat) === 'percent') return '%';
  const max = round2(statMax(stat));
  return `of ${max >= COMPACT_TAG_FLOOR ? compactNumber.format(max).toLowerCase() : max}`;
}

/** The right inset that keeps a typed value clear of its tag, in rem. */
export function thresholdTagInsetRem(tag: string): number {
  return tag.length * 0.55 + 1.1;
}

/** A threshold input's width: the tag's inset plus room for the value itself, floored at the classic
 *  7rem box so short tags render exactly as they always have. */
export function thresholdInputWidthRem(tag: string): number {
  return Math.max(7, thresholdTagInsetRem(tag) + 4.5);
}

/** The left edge that centers the start caption under its marker while keeping it inside the bar: pinned
 *  at whichever edge centering would spill past, and at the left when it cannot fit at all. */
export function startCaptionLeft(markerCenter: number, captionWidth: number, containerWidth: number): number {
  return Math.max(0, Math.min(markerCenter - captionWidth / 2, containerWidth - captionWidth));
}

/** A raw value spelled in the stat's threshold unit — `3 of 10` or `30%` — so a message comparing a value
 *  against a threshold states both in the same terms. */
export function describeInThresholdUnits(stat: BandedStat, value: number): string {
  return thresholdUnitOf(stat) === 'percent'
    ? `${valueThreshold(stat, value)}%`
    : `${round2(value)} ${thresholdUnitTag(stat)}`;
}

/** A stored threshold spelled the same way, for talking about the number the author typed. */
export function describeThreshold(stat: BandedStat, threshold: number): string {
  return thresholdUnitOf(stat) === 'percent' ? `${round2(threshold)}%` : `${round2(threshold)} ${thresholdUnitTag(stat)}`;
}

/** Whether a stored threshold lands outside what the stat can ever hold, under its own unit. */
export function isThresholdOutOfRange(stat: BandedStat, threshold: number): boolean {
  const value = thresholdValue(stat, threshold);
  return value < statMin(stat) || value > statMax(stat);
}

/** Every threshold rewritten into `unit`, covering exactly what it covered before. A whole list because
 *  the toggle has to write once — per-row writes each read the same stale list and only the last survives. */
export function convertDescriptorUnits(stat: BandedStat, unit: ThresholdUnit): StatDescriptor[] {
  if (thresholdUnitOf(stat) === unit) return [...(stat.descriptors ?? [])];
  const min = statMin(stat);
  const range = statMax(stat) - min;
  return (stat.descriptors ?? []).map((descriptor) => {
    const raw = thresholdValue(stat, descriptor.threshold);
    const converted = unit === 'percent'
      ? (range === 0 ? 0 : ((raw - min) / range) * 100)
      : raw;
    return { ...descriptor, threshold: round2(converted) };
  });
}
