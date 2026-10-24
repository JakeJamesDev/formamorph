import type { ReactNode } from "react";
import IndeterminateProgress from "@/components/ui/indeterminate-progress";
import { Meta } from "@/components/ui/typography";

/** One running request: a glyph slot, its label, and the indeterminate bar. Carries no position of its own. */
export function RequestStatusRow({ label, glyph }: { label: string; glyph?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden data-slot="status-glyph" className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
        {glyph}
      </span>
      <Meta className="truncate min-w-0 max-w-[60%]">{label}</Meta>
      <div className="flex-grow">
        <IndeterminateProgress />
      </div>
    </div>
  );
}

/**
 * Floats a status row over the bottom edge of the narration frame, on a fade from the frame's fill.
 * Its parent is the footer, positioned; the strip sits above it so the footer's height never changes.
 */
export function RequestStatusStrip({ children }: { children: ReactNode }) {
  return (
    // bottom-full plus the column's gap-2 and the frame's 1px border; inset-x-px keeps it inside that border.
    // z-[5] sits over the narration but under the frame's own z-10 controls, such as Chat's Jump to Latest.
    <div className="pointer-events-none absolute inset-x-px bottom-[calc(100%+0.5rem+1px)] z-[5]bg-gradient-to-t from-muted via-muted/90 to-transparent px-2 pb-1.5 pt-5">
      {children}
    </div>
  );
}
