import type { ReactNode } from 'react';
import { useElementSize } from '@/lib/useElementSize';

/** The row's `gap-3`, in pixels. */
const GAP = 12;

/**
 * A surface's full-width top row: identity at the start, tools on the window's center line, actions at the
 * end. The center column leaves the end cell's measured width on both sides, so the side columns stay equal
 * while it can. At its floor, it moves off center rather than overlap.
 * The row uses the shared surface-header geometry: 12px sides, centered in 56px.
 */
export function SurfaceAppBar({ start, center, end }: { start: ReactNode; center?: ReactNode; end?: ReactNode }) {
  const [endRef, { width: endWidth }] = useElementSize();
  return (
    <div
      className="grid min-h-14 items-center gap-3 px-3 py-2"
      style={{ gridTemplateColumns: `minmax(0,1fr) minmax(10rem,min(26rem,calc(100% - ${2 * (endWidth + GAP)}px))) minmax(max-content,1fr)` }}
    >
      <div className="flex min-w-0 items-center gap-1">{start}</div>
      <div className="flex min-w-0 items-center justify-center gap-1">{center}</div>
      {/* Hugs its content, because a stretched cell would measure its column instead. */}
      <div ref={endRef} className="flex items-center justify-end justify-self-end gap-1 pr-[var(--window-buttons-width)]">{end}</div>
    </div>
  );
}
