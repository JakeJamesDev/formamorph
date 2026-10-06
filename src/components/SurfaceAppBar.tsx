import type { ReactNode } from 'react';

/**
 * A surface's full-width top row: identity at the start, tools on the window's center line, actions at the
 * end. The side columns share the leftover width equally, so the center group stays centered whatever the
 * sides hold. The row uses the shared surface-header geometry: 12px sides, centered in 56px.
 */
export function SurfaceAppBar({ start, center, end }: { start: ReactNode; center?: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-1">{start}</div>
      {center && <div className="flex shrink-0 items-center gap-1">{center}</div>}
      <div className="flex min-w-0 flex-1 basis-0 items-center justify-end gap-1">{end}</div>
    </div>
  );
}
