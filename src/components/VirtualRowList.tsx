import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer, defaultRangeExtractor, type Range } from '@tanstack/react-virtual';
import { EditorRowList } from '@/components/EditorRow';

/** Row count above which an editor list mounts only the rows near the viewport. */
export const VIRTUALIZE_AT = 200;

/** Estimated row height: EditorRow's `min-h-14` (56px); real heights are measured per row. */
const ROW_ESTIMATE = 56;
/** EditorRowList's `gap-1`, in px. */
const ROW_GAP = 4;

/**
 * Editor rows windowed to the nearest ScrollArea viewport: only the rows near it mount, absolutely placed
 * inside a box the height of the whole list. Pinned rows stay mounted wherever the window is, so a drag
 * survives auto-scroll carrying its row out of view. Unwindowed, or with no ScrollArea above it, every row
 * mounts in flow; both modes keep one element structure, so switching never remounts a row.
 */
export function VirtualRowList({ count, rowKey, renderRow, pinned, windowed = true, className, listRef }: {
  count: number;
  /** Should keep its identity while the rows do. */
  rowKey: (index: number) => string;
  renderRow: (index: number) => ReactNode;
  /** Indexes kept mounted outside the window, such as the dragged row and its drop target. */
  pinned?: readonly number[];
  windowed?: boolean;
  className?: string;
  /** The list element, for a list that is also a drop target. */
  listRef?: (el: HTMLDivElement | null) => void;
}) {
  const ownRef = useRef<HTMLDivElement | null>(null);
  // Undefined until the first layout pass looks; null when there is no viewport to window against.
  const [scrollEl, setScrollEl] = useState<HTMLElement | null | undefined>(undefined);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    setScrollEl((ownRef.current?.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null) ?? null);
  }, []);
  // Anchors the window to the list's offset in the viewport, again whenever the scroll content resizes.
  useLayoutEffect(() => {
    const list = ownRef.current;
    if (!list || !scrollEl) return;
    const measure = () => {
      const margin = list.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
      setScrollMargin((prev) => (Math.abs(prev - margin) > 1 ? margin : prev));
    };
    measure();
    const content = scrollEl.firstElementChild;
    if (typeof ResizeObserver === 'undefined' || !content) return;
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollEl]);

  const pinKey = pinned?.join(',') ?? '';
  const rangeExtractor = useCallback((range: Range) => {
    const indexes = new Set(defaultRangeExtractor(range));
    for (const i of pinKey ? pinKey.split(',').map(Number) : []) if (i >= 0 && i < range.count) indexes.add(i);
    // Sorted, so the DOM and the tab order follow the rows' visual order.
    return [...indexes].sort((a, b) => a - b);
  }, [pinKey]);

  const virtualizer = useVirtualizer({
    // Off while unwindowed, so scrolling a short list redraws nothing.
    enabled: windowed,
    count,
    getScrollElement: () => scrollEl ?? null,
    estimateSize: () => ROW_ESTIMATE,
    getItemKey: rowKey,
    gap: ROW_GAP,
    overscan: 8,
    scrollMargin,
    rangeExtractor,
    // The window before the first measurement, and jsdom's window throughout.
    initialRect: { width: 600, height: 600 },
  });

  const setRef = (el: HTMLDivElement | null) => { ownRef.current = el; listRef?.(el); };

  if (!windowed || scrollEl === null) {
    return (
      <EditorRowList ref={setRef} className={className}>
        {Array.from({ length: count }, (_, i) => <div key={rowKey(i)}>{renderRow(i)}</div>)}
      </EditorRowList>
    );
  }
  return (
    <EditorRowList ref={setRef} className={className} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => (
        <div
          key={rowKey(row.index)}
          ref={virtualizer.measureElement}
          data-index={row.index}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${row.start - scrollMargin}px)` }}
        >
          {renderRow(row.index)}
        </div>
      ))}
    </EditorRowList>
  );
}
