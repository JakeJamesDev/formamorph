import type { SegmentFold } from '@/lib/collapsingSegments';

/** Each top-bar element's width at each of its steps, in CSS pixels, from hidden measuring copies. */
export interface HeaderWidths {
  /** The bar's own width. */
  bar: number;
  /** The gap between the bar's cells, and between controls in the right cell. */
  gap: number;
  /** Absent where the library tabs are hidden, below `md`. */
  tabs: Record<SegmentFold, number> | null;
  /** The action buttons in a row, at the widest library tab's labels. */
  center: number;
  /** The view toggle, the direct buttons beside it while the action buttons are in a row, and the menu that replaces them. */
  right: { toggle: number; direct: number; more: number };
  /** Absent while no event badge shows. */
  badges: { full: number; count: number } | null;
}

/** Which step each top-bar element takes. */
export interface HeaderFold {
  tabs: SegmentFold;
  center: 'full' | 'menu';
  badges: 'full' | 'count';
}

/** The fold order: the library tabs fold all the way first, then the action buttons, then the badges. */
export const HEADER_FOLD_LEVELS: readonly HeaderFold[] = [
  { tabs: 'full', center: 'full', badges: 'full' },
  { tabs: 'active', center: 'full', badges: 'full' },
  { tabs: 'icons', center: 'full', badges: 'full' },
  { tabs: 'icons', center: 'menu', badges: 'full' },
  { tabs: 'icons', center: 'menu', badges: 'count' },
];

const row = (parts: (number | null)[], gap: number) => {
  const present = parts.filter((p): p is number => p !== null);
  return present.reduce((a, b) => a + b, 0) + gap * Math.max(0, present.length - 1);
};

/** The whole bar's width at one fold: every cell side by side, with no room left to center the middle. */
export function headerRowWidth(w: HeaderWidths, fold: HeaderFold): number {
  const inRow = fold.center === 'full';
  const right = row([w.badges ? w.badges[fold.badges] : null, w.right.toggle, inRow ? w.right.direct : w.right.more], w.gap);
  return row([w.tabs ? w.tabs[fold.tabs] : null, inRow ? w.center : null, right], w.gap);
}

/** The first fold, in order, at which the bar's cells fit side by side; the last fold when none does. */
export function headerFold(w: HeaderWidths): HeaderFold {
  return HEADER_FOLD_LEVELS.find((fold) => headerRowWidth(w, fold) <= w.bar + 0.5) ?? HEADER_FOLD_LEVELS[HEADER_FOLD_LEVELS.length - 1];
}
