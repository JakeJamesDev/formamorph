import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { Tip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** One place worth seeing in the content, drawn as a tick in the scroll bar's track. */
export interface ScrollMark {
  /** Where it sits, as a 0–1 fraction of the scrollable height. */
  fraction: number
  /** The one the reader is on, drawn stronger than the rest. */
  current?: boolean
  /** The tick's accessible name — what jumping there goes to. */
  label?: string
}

/** Tick height in pixels, needed so a tick at the far end still lands inside the track. */
const MARK_HEIGHT = 3

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    /** The element that actually scrolls. `ref` lands on Root, which never moves — a caller that has to
     *  read or set the scroll position needs this one. */
    viewportRef?: React.Ref<HTMLDivElement>
    /** Overview ruler: one tick per place worth jumping to, drawn inside the scroll bar's own track.
     *  Pair with `type="always"` so the bar cannot auto-hide while the ticks matter. */
    marks?: ScrollMark[]
    /** Called with a tick's position in `marks` when it is clicked. */
    onMarkSelect?: (index: number) => void
  }
>(({ className, children, viewportRef, marks, onMarkSelect, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative flex flex-col overflow-hidden", className)}
    {...props}>
    {/* The viewport is sized by flex (`flex-auto min-h-0`), not `h-full`: a percentage height cannot
        resolve when an ancestor is capped only by `max-h-*` (its height is indefinite), so the viewport
        silently grew to content height and nothing wheel-scrolled. Flex sizing fills the root's used
        height either way. The scrollbar and corner are absolutely positioned, so the viewport is the
        root's only in-flow child.
        Reserve a gutter slightly wider than the scrollbar (w-2.5 = 10px) so content never sits
        under the overlay bar, plus a 1px margin so the bar isn't flush against the content.
        `[&>div]:!block` overrides Radix's inline `display:table` on the viewport's content wrapper —
        table shrink-wraps to content width, letting long rows overflow horizontally (breaking `truncate`);
        block keeps it viewport-width so children clip. We have no horizontal ScrollArea, so this is safe. */}
    <ScrollAreaPrimitive.Viewport ref={viewportRef} className="w-full flex-auto min-h-0 rounded-[inherit] pr-[11px] [&>div]:!block">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar marks={marks} onMarkSelect={onMarkSelect} />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
    marks?: ScrollMark[]
    onMarkSelect?: (index: number) => void
  }
>(({ className, orientation = "vertical", marks, onMarkSelect, ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "relative flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
    {/* Ticks sit over the thumb, positioned by fraction. `calc` against the track's own height keeps a
        tick inside it at either end without measuring anything. Their pointerdown is stopped so Radix's
        click-to-scroll on the track doesn't swallow the jump. */}
    {orientation === "vertical" && marks?.map((mark, i) => (
      <Tip key={i} tip={mark.label} side="left">
        <button
          type="button"
          data-scroll-mark={i}
          data-current={mark.current ? "" : undefined}
          aria-label={mark.label ?? `Jump to mark ${i + 1}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onMarkSelect?.(i)}
          style={{ top: `calc(${mark.fraction} * (100% - ${MARK_HEIGHT}px))` }}
          className={cn(
            "absolute inset-x-0 h-[3px] rounded-sm",
            mark.current ? "bg-amber-500 ring-1 ring-amber-700" : "bg-amber-400/80 hover:bg-amber-400"
          )}
        />
      </Tip>
    ))}
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
