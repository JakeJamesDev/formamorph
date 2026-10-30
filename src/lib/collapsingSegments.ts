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
 * Picks the most labels that fit `room`. The `active` step is sized for the widest label, so picking a
 * different segment never changes the step.
 *
 * @param full - Each segment's width with its label
 * @param icon - Each segment's width as an icon alone
 * @param inset - The group's padding on each side
 */
export function segmentFold(full: readonly number[], icon: readonly number[], room: number, inset: number): SegmentFold {
  if (room >= sum(full) + 2 * inset - 0.5) return 'full';
  const widestLabel = Math.max(0, ...full.map((width, i) => width - (icon[i] ?? width)));
  return room >= sum(icon) + widestLabel + 2 * inset - 0.5 ? 'active' : 'icons';
}

/**
 * Lays out a collapsing segmented control: each segment takes its labeled width when `fold` shows its
 * label, and its icon width otherwise.
 *
 * @param full - Each segment's width with its label
 * @param icon - Each segment's width as an icon alone
 * @param active - The index of the selected segment
 * @param inset - The group's padding on each side
 */
export function segmentLayout(full: readonly number[], icon: readonly number[], active: number, fold: SegmentFold, inset: number): SegmentLayout {
  const widths = full.map((width, i) => (fold === 'full' || (fold === 'active' && i === active) ? width : icon[i] ?? width));
  const lefts: number[] = [];
  let x = inset;
  for (const width of widths) {
    lefts.push(x);
    x += width;
  }
  return { lefts, widths, total: x + inset };
}
