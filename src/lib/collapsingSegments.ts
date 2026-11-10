/** How much of each label a collapsing segmented control shows: all, the selected one's, or none. */
export type SegmentFold = 'full' | 'active' | 'icons';

/** Where each segment of a collapsing segmented control sits, in CSS pixels from the group's left edge. */
export interface SegmentLayout {
  lefts: number[];
  widths: number[];
  /** The group's whole width, insets included. */
  total: number;
}

const sum = (widths: readonly number[]) => widths.reduce((a, b) => a + b, 0);

/**
 * The group's width at each step. `active` is sized for the widest label, so picking a different segment
 * never changes which step fits.
 *
 * @param full - Each segment's width with its label
 * @param icon - Each segment's width as an icon alone
 * @param inset - The group's padding on each side
 */
export function segmentStepWidths(full: readonly number[], icon: readonly number[], inset: number): Record<SegmentFold, number> {
  const icons = full.map((width, i) => icon[i] ?? width);
  const widestLabel = Math.max(0, ...full.map((width, i) => width - icons[i]));
  return { full: sum(full) + 2 * inset, active: sum(icons) + widestLabel + 2 * inset, icons: sum(icons) + 2 * inset };
}

/** Picks the most labels that fit `room`, by `segmentStepWidths`. */
export function segmentFold(full: readonly number[], icon: readonly number[], room: number, inset: number): SegmentFold {
  const steps = segmentStepWidths(full, icon, inset);
  if (room >= steps.full - 0.5) return 'full';
  return room >= steps.active - 0.5 ? 'active' : 'icons';
}

/** The step a strip has to keep when an option has no icon to fold down to. */
export const iconlessFold = (options: readonly { icon?: unknown }[]): SegmentFold | undefined =>
  (options.some((option) => !option.icon) ? 'full' : undefined);

/** Whether the segment at `index` shows its label at `fold`. */
export function labelShown(fold: SegmentFold, index: number, active: number): boolean {
  return fold === 'full' || (fold === 'active' && index === active);
}

/**
 * Lays out a collapsing segmented control: each segment takes its labeled width when `fold` shows its
 * label, and its icon width otherwise.
 *
 * @param full - Each segment's width with its label
 * @param icon - Each segment's width as an icon alone
 * @param active - The index of the selected segment
 * @param inset - The group's padding on each side
 * @param fill - A width to stretch the group to, its spare room shared evenly between the segments
 */
export function segmentLayout(full: readonly number[], icon: readonly number[], active: number, fold: SegmentFold, inset: number, fill?: number): SegmentLayout {
  const own = full.map((width, i) => (labelShown(fold, i, active) ? width : icon[i] ?? width));
  const spare = fill === undefined || own.length === 0 ? 0 : Math.max(0, fill - sum(own) - 2 * inset) / own.length;
  const widths = own.map((width) => width + spare);
  const lefts: number[] = [];
  let x = inset;
  for (const width of widths) {
    lefts.push(x);
    x += width;
  }
  return { lefts, widths, total: x + inset };
}
