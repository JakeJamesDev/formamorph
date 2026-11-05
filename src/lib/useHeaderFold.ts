import { useLayoutEffect, useState, type RefObject } from 'react';
import type { SegmentFold } from '@/lib/collapsingSegments';
import { HEADER_FOLD_LEVELS, headerFold, type HeaderFold, type HeaderWidths } from '@/lib/headerFold';

/** The bar's `gap-2`, between its cells and between the right cell's controls. */
const GAP = 8;
const UNMEASURED_TABS: Record<SegmentFold, number> = { full: 0, active: 0, icons: 0 };

const sameFold = (a: HeaderFold, b: HeaderFold) => a.tabs === b.tabs && a.center === b.center && a.badges === b.badges;

/**
 * Picks the main menu top bar's fold from its measured parts.
 *
 * The bar marks its parts with data attributes: `data-fold-left` on the library tabs' cell,
 * `data-fold-live="toggle"` on the view toggle, `data-fold-window-buttons` on its spacer, and hidden copies marked `data-fold-measure` as `center`
 * (one per library tab), `right-direct`, `right-more`, `badges-full` and `badges-count`.
 *
 * @param bar - The top bar
 * @param tabs - The library tabs' width at each step, from the tabs themselves
 * @param layoutKey - Changes whenever the set of measured copies does, so the observer picks up new ones
 */
export function useHeaderFold(bar: RefObject<HTMLElement | null>, tabs: Record<SegmentFold, number> | null, layoutKey: string): HeaderFold {
  const [fold, setFold] = useState<HeaderFold>(HEADER_FOLD_LEVELS[0]);

  useLayoutEffect(() => {
    const node = bar.current;
    if (!node) return;
    const width = (selector: string) => node.querySelector<HTMLElement>(selector)?.offsetWidth ?? 0;

    const read = () => {
      const left = node.querySelector<HTMLElement>('[data-fold-left]');
      const tabsShown = !!left && getComputedStyle(left).display !== 'none';
      const centers = Array.from(node.querySelectorAll<HTMLElement>('[data-fold-measure="center"]'), (e) => e.offsetWidth);
      const hasBadges = !!node.querySelector('[data-fold-measure="badges-full"]');
      const widths: HeaderWidths = {
        // The spacer holds the room for the window buttons, so it can't hold a control.
        bar: node.clientWidth - width('[data-fold-window-buttons]'),
        gap: GAP,
        tabs: tabsShown ? tabs ?? UNMEASURED_TABS : null,
        center: Math.max(0, ...centers),
        right: { toggle: width('[data-fold-live="toggle"]'), direct: width('[data-fold-measure="right-direct"]'), more: width('[data-fold-measure="right-more"]') },
        badges: hasBadges ? { full: width('[data-fold-measure="badges-full"]'), count: width('[data-fold-measure="badges-count"]') } : null,
      };
      const next = headerFold(widths);
      setFold((held) => (sameFold(held, next) ? held : next));
    };

    read();
    // jsdom has no ResizeObserver in every suite; the first read is what those runs get.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    node.querySelectorAll('[data-fold-measure], [data-fold-live], [data-fold-window-buttons]').forEach((e) => observer.observe(e));
    return () => observer.disconnect();
  }, [bar, tabs, layoutKey]);

  return fold;
}
