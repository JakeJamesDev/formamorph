import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

/** Positions the content against an element other than the trigger — for one popover shared by many
 *  candidate anchors (e.g. a list of chips). */
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  // `portal={false}` renders inline instead of portaling to <body> — needed inside a modal Dialog,
  // whose react-remove-scroll lock swallows wheel scroll on anything portaled outside its subtree.
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { portal?: boolean }
>(({ className, align = "center", sideOffset = 4, portal = true, ...props }, ref) => {
  const content = (
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props} />
  );
  return portal ? <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal> : content;
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

const PopoverClose = PopoverPrimitive.Close

/** Radix's default arrow strokes all three sides, so its base draws a line across the popover's own
 *  border and the arrow reads as a separate shape stuck to the edge. This one strokes only the two
 *  slanted sides and sits a pixel into the popover, so its fill hides the border segment behind it and
 *  the outline runs continuously around the whole bubble. */
const PopoverArrow = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Arrow>
>(({ className, width = 20, height = 10, ...props }, ref) => (
  <PopoverPrimitive.Arrow ref={ref} asChild width={width} height={height} {...props}>
    {/* overflow-visible keeps the stroked tip from clipping against the viewBox edge. */}
    {/* Shifted a pixel into the popover so the fill hides the border segment behind the base, and the
        two strokes cross that border line rather than stopping short of it. */}
    <svg viewBox="0 0 20 10" className={cn("overflow-visible -translate-y-px", className)}>
      <polygon points="0,0 20,0 10,10" className="fill-popover" />
      <path d="M0 0 L10 10 L20 0" className="fill-none stroke-border" strokeWidth={1} />
    </svg>
  </PopoverPrimitive.Arrow>
))
PopoverArrow.displayName = PopoverPrimitive.Arrow.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent, PopoverClose, PopoverArrow }
