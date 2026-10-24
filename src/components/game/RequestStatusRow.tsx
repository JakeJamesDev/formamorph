import { useEffect, useState, type ReactNode } from "react";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Meta } from "@/components/ui/typography";

const TIMER_DELAY_MS = 3000;

/** Whole seconds since `startedAt` once the delay has passed; null before. Ticks once a second. */
function useElapsedSeconds(startedAt: number | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === undefined) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (startedAt === undefined) return null;
  const elapsed = now - startedAt;
  return elapsed >= TIMER_DELAY_MS ? Math.floor(elapsed / 1000) : null;
}

/**
 * One running request: a glyph slot, its label, the indeterminate bar, and the turn timer.
 * `startedAt` (epoch ms) is the turn's start; leave it unset for rows that show no timer.
 * Carries no position of its own.
 */
export function RequestStatusRow({ label, glyph, startedAt }: { label: string; glyph?: ReactNode; startedAt?: number }) {
  const seconds = useElapsedSeconds(startedAt);
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden data-slot="status-glyph" className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
        {glyph}
      </span>
      <Meta className="truncate min-w-0 max-w-[60%]">{label}</Meta>
      <div className="flex-grow">
        <IndeterminateProgress />
      </div>
      {seconds !== null && <Meta data-slot="status-timer" className="shrink-0 tabular-nums">{seconds}s</Meta>}
    </div>
  );
}

/**
 * Floats a status row over the bottom edge of the narration frame, where the narration's `NARRATION_FADE_UNDER_STRIP` clears room.
 * Its parent is the footer, positioned; the strip sits above it so the footer's height never changes.
 */
export function RequestStatusStrip({ children }: { children: ReactNode }) {
  return (
    // bottom-full plus the column's gap-2 and the frame's 1px border; inset-x-px keeps it inside that border.
    // z-[5] sits over the narration but under the frame's own z-10 controls, such as Chat's Jump to Latest.
    <div className="pointer-events-none absolute inset-x-px bottom-[calc(100%+0.5rem+1px)] z-[5] px-2 pb-1.5">
      {children}
    </div>
  );
}
