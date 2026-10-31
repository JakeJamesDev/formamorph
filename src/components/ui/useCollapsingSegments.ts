import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { segmentFold, segmentLayout, segmentStepWidths, type SegmentFold, type SegmentLayout } from '@/lib/collapsingSegments';

/** The group's `p-1`, on each side. */
export const SEGMENT_INSET = 4;
/** Horizontal metrics shared by the live segments and the hidden measuring copies. */
export const SEGMENT_X = 'px-3 text-label font-medium whitespace-nowrap';
export const SEGMENT_MOTION = 'duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';

interface Measured {
  full: number[];
  icon: number[];
  room: number;
}

const sameNumbers = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

export interface CollapsingSegments {
  rootRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
  /** True once the measuring rows have a width; before that the segments keep their own styles. */
  ready: boolean;
  /** True from the frame after `ready` for the current labels, so the pill lands without a slide. */
  animate: boolean;
  fold: SegmentFold;
  layout: SegmentLayout;
  minWidth: number | undefined;
  /** The width with every label shown, once measured. A host that hugs its tabs uses it as its basis. */
  fullWidth: number | undefined;
}

/**
 * Measures a collapsing segmented control and picks its step. The host renders `SegmentMeasure` into
 * `measureRef` and puts `rootRef` on the element whose width is the control's room.
 *
 * `fill` stretches the segments to that room. `fold` is a step chosen by the host instead of by the room.
 */
export function useCollapsingSegments({ labels, active, fold: hostFold, onStepWidths, fill = false }: {
  labels: readonly string[];
  active: number;
  fold?: SegmentFold;
  onStepWidths?: (widths: Record<SegmentFold, number>) => void;
  fill?: boolean;
}): CollapsingSegments {
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const labelKey = labels.join('\u0000');
  const fullWidth = measured?.full.some((w) => w > 0) ? segmentStepWidths(measured.full, measured.icon, SEGMENT_INSET).full : undefined;
  // Motion belongs to one label set, so tabs that arrive or rename land on their step without a slide.
  const [animatedKey, setAnimatedKey] = useState<string | null>(null);
  const animate = animatedKey === labelKey;

  useLayoutEffect(() => {
    const root = rootRef.current;
    const rows = measureRef.current?.children;
    if (!root || !rows || rows.length < 2) return;
    const widths = (row: Element) => Array.from(row.children, (c) => (c as HTMLElement).offsetWidth);
    const read = () => {
      const full = widths(rows[0]);
      const icon = widths(rows[1]);
      const room = root.offsetWidth;
      // Held arrays stay identical while their numbers do, so a resize alone never re-reports step widths.
      setMeasured((held) => {
        const sameFull = !!held && sameNumbers(held.full, full);
        const sameIcon = !!held && sameNumbers(held.icon, icon);
        if (held && sameFull && sameIcon && held.room === room) return held;
        return { full: held && sameFull ? held.full : full, icon: held && sameIcon ? held.icon : icon, room };
      });
    };
    read();
    // jsdom has no ResizeObserver in every suite; the first read is what those runs get.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    observer?.observe(root);
    observer?.observe(rows[0]);
    return () => observer?.disconnect();
    // A hugging host's room follows `fullWidth`, so it is read again before paint when that changes.
  }, [labelKey, fullWidth]);

  const ready = !!measured && measured.full.some((w) => w > 0);
  useLayoutEffect(() => {
    if (!ready || animate) return;
    const frame = requestAnimationFrame(() => setAnimatedKey(labelKey));
    return () => cancelAnimationFrame(frame);
  }, [ready, animate, labelKey]);

  const full = measured?.full;
  const icon = measured?.icon;
  const reportRef = useRef(onStepWidths);
  reportRef.current = onStepWidths;
  useEffect(() => {
    if (ready && full && icon) reportRef.current?.(segmentStepWidths(full, icon, SEGMENT_INSET));
  }, [ready, full, icon]);

  const fullWidths = full ?? [];
  const iconWidths = icon ?? [];
  const room = measured?.room ?? 0;
  const ownFold = ready && room > 0 ? segmentFold(fullWidths, iconWidths, room, SEGMENT_INSET) : 'full';
  const fold = hostFold ?? ownFold;
  const layout = segmentLayout(fullWidths, iconWidths, active, fold, SEGMENT_INSET, fill && room > 0 ? room : undefined);
  // A host-chosen step holds its own width open, so the host's row can push the cells beside it.
  const minWidth = ready
    ? hostFold ? segmentLayout(fullWidths, iconWidths, active, hostFold, SEGMENT_INSET).total : segmentLayout(fullWidths, iconWidths, active, 'icons', SEGMENT_INSET).total
    : undefined;

  return { rootRef, measureRef, ready, animate, fold, layout, minWidth, fullWidth };
}
