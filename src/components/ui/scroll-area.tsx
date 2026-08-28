import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    /** The element that actually scrolls. `ref` lands on Root, which never moves — a caller that has to
     *  read or set the scroll position needs this one. */
    viewportRef?: React.Ref<HTMLDivElement>
  }
>(({ className, children, viewportRef, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}>
    {/* Reserve a gutter slightly wider than the scrollbar (w-2.5 = 10px) so content never sits
        under the overlay bar, plus a 1px margin so the bar isn't flush against the content.
        `[&>div]:!block` overrides Radix's inline `display:table` on the viewport's content wrapper —
        table shrink-wraps to content width, letting long rows overflow horizontally (breaking `truncate`);
        block keeps it viewport-width so children clip. We have no horizontal ScrollArea, so this is safe. */}
    <ScrollAreaPrimitive.Viewport ref={viewportRef} className="h-full w-full rounded-[inherit] pr-[11px] [&>div]:!block">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-colors",
      orientation === "vertical" &&
        "h-full w-2.5 border-l border-l-transparent p-[1px]",
      orientation === "horizontal" &&
        "h-2.5 flex-col border-t border-t-transparent p-[1px]",
      className
    )}
    {...props}>
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
