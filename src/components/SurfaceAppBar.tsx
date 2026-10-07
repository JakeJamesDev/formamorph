import type { ReactNode } from 'react';

/**
 * A surface's full-width top row: identity at the start, tools on the window's center line, actions at the
 * end. Three equal columns keep the center group centered while the end column holds its content; when the
 * window is too narrow for that, the center shrinks to its floor and moves off center rather than overlap.
 * The row uses the shared surface-header geometry: 12px sides, centered in 56px.
 */
export function SurfaceAppBar({ start, center, end }: { start: ReactNode; center?: ReactNode; end?: ReactNode }) {
  return (
    <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(10rem,1fr)_minmax(max-content,1fr)] items-center gap-3 px-3 py-2">
      <div className="flex min-w-0 items-center gap-1">{start}</div>
      <div className="flex min-w-0 items-center justify-center gap-1">{center}</div>
      <div className="flex items-center justify-end gap-1">{end}</div>
    </div>
  );
}
