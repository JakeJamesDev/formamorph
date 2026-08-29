import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

/** Shared open delay, and the window in which moving to a neighboring trigger opens instantly. Both
 *  live on the provider so no call site can retune them. Native `title` waited about a second; this is
 *  fast enough to feel like part of the app and slow enough not to fire while the pointer crosses. */
const TOOLTIP_DELAY_MS = 400

/**
 * Mounted once at the application root. It owns tooltip timing for the whole app: every tip waits the
 * same beat, and once one is open its neighbors open with no wait at all.
 */
function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delay={TOOLTIP_DELAY_MS} timeout={TOOLTIP_DELAY_MS}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

const Tooltip = TooltipPrimitive.Root

/** Composes onto an existing control through `render`, so no wrapper element enters the DOM. The
 *  rendered child must forward its ref (the `formamorph/composed-forwardref` lint rule checks this). */
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipPortal = TooltipPrimitive.Portal

/** Sits above dialogs (z-50) and the prompt chip typeahead (z-70): a tip can be raised from inside both. */
const TooltipPositioner = React.forwardRef<HTMLDivElement, TooltipPrimitive.Positioner.Props>(
  ({ className, sideOffset = 6, ...props }, ref) => (
    <TooltipPrimitive.Positioner
      ref={ref}
      sideOffset={sideOffset}
      className={cn("z-[80]", className)}
      {...props}
    />
  )
)
TooltipPositioner.displayName = "TooltipPositioner"

/** The bubble. Popover tokens, so it themes with every palette in both modes. Base UI drives the enter
 *  and exit through `data-starting-style` / `data-ending-style`, and marks an instant open — keyboard
 *  focus, or a neighbor inside the group window — with `data-instant`, which skips the animation. */
const TooltipPopup = React.forwardRef<HTMLDivElement, TooltipPrimitive.Popup.Props>(
  ({ className, ...props }, ref) => (
    <TooltipPrimitive.Popup
      ref={ref}
      className={cn(
        "max-w-64 rounded-md border bg-popover px-2 py-1 text-helper text-popover-foreground shadow-md",
        "origin-[var(--transform-origin)] scale-100 opacity-100 transition-[opacity,transform] duration-150 ease-out",
        "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
        "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
        "data-[instant]:transition-none motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
)
TooltipPopup.displayName = "TooltipPopup"

interface TipProps {
  /** The hint. Empty or absent renders the child alone, so a conditional tip needs no call-site branch. */
  tip?: string | null
  /** The control the tip belongs to. It is rendered as the trigger itself and must forward its ref. */
  children: React.ReactElement
  side?: TooltipPrimitive.Positioner.Props["side"]
  align?: TooltipPrimitive.Positioner.Props["align"]
  /**
   * Whether the tip also names the child for assistive technology. Left unset it names a child that has
   * no `aria-label` or `aria-labelledby` of its own, which is what an icon-only control wants. Pass
   * `false` where the child's visible text already names it and the tip only spells that text out.
   */
  labelsChild?: boolean
}

/**
 * A themed hover and focus hint, in one line at the call site.
 *
 * A Base UI tooltip is a visual affordance only: the popup carries no role and is never announced. So
 * the accessible name has to live on the control, and by default this applies the tip text as that name
 * when the child brings none. The two strings then cannot drift, which is what the native `title` they
 * replace gave for free. See `labelsChild` for the exception.
 *
 * Tips do not open on tap, by Base UI's design and in parity with `title`. Nothing important belongs in
 * one.
 */
function Tip({ tip, children, side = "top", align = "center", labelsChild }: TipProps) {
  if (!tip) return children

  const childProps = children.props as { "aria-label"?: string; "aria-labelledby"?: string }
  const names = labelsChild ?? !(childProps["aria-label"] || childProps["aria-labelledby"])

  return (
    <Tooltip>
      <TooltipTrigger aria-label={names ? tip : undefined} render={children} />
      <TooltipPortal>
        <TooltipPositioner side={side} align={align}>
          <TooltipPopup>{tip}</TooltipPopup>
        </TooltipPositioner>
      </TooltipPortal>
    </Tooltip>
  )
}

export {
  Tip,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
}
