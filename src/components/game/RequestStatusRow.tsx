import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Meta } from "@/components/ui/typography";
import { StatusGlyph } from "./statusGlyphs/StatusGlyph";
import type { StatusGlyphKey } from "./statusGlyphs/glyphMap";

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

/** How long a glyph shows before the next one may replace it. */
const GLYPH_DWELL_MS = 300;
const GLYPH_CROSSFADE_S = 0.15;

/** Holds `value` until the shown one has been on screen for `ms`, then takes the latest. */
function useDwell<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    if (value === shown) return;
    const swap = () => {
      shownAt.current = Date.now();
      setShown(value);
    };
    const wait = shownAt.current + ms - Date.now();
    if (wait <= 0) {
      swap();
      return;
    }
    const id = setTimeout(swap, wait);
    return () => clearTimeout(id);
  }, [value, shown, ms]);
  return shown;
}

/**
 * One running request: its glyph, its label, the indeterminate bar, and the turn timer.
 * `startedAt` (epoch ms) is the turn's start; leave it unset for rows that show no timer.
 * Carries no position of its own.
 */
export function RequestStatusRow({ label, glyph, startedAt }: { label: string; glyph: StatusGlyphKey; startedAt?: number }) {
  const shownGlyph = useDwell(glyph, GLYPH_DWELL_MS);
  const seconds = useElapsedSeconds(startedAt);
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden data-slot="status-glyph" className="relative size-4 shrink-0 text-muted-foreground">
        <AnimatePresence initial={false}>
          <motion.span
            key={shownGlyph}
            data-glyph={shownGlyph}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: GLYPH_CROSSFADE_S }}
          >
            <StatusGlyph glyph={shownGlyph} />
          </motion.span>
        </AnimatePresence>
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
