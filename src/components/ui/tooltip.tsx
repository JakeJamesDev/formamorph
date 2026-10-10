import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

/** Shared open delay, and the window in which moving to a neighboring trigger opens instantly. Both
 *  live on the provider so no call site can retune them. Native `title` waited about a second; this is
 *  fast enough to feel like part of the app and slow enough not to fire while the pointer crosses. */
const TOOLTIP_DELAY_MS = 400

type TipPayload = Pick<TipProps, "side" | "align"> & { tip: string }

/** Joins every `Tip` trigger to the one root the provider mounts. One provider is mounted at a time. */
const tipHandle = TooltipPrimitive.createHandle<TipPayload>()

/** Whether a pointer button is held. A press, a drag and a text selection all run with one down. */
let pointerHeld = false

/** Cancels a hover open while a button is held, so a drag across the board opens nothing. Focus still
 *  opens. Returns whether it canceled. */
function cancelHoverOpenWhileHeld(next: boolean, details: TooltipPrimitive.Root.ChangeEventDetails) {
  if (!next || !pointerHeld || details.reason !== "trigger-hover") return false
  details.cancel()
  return true
}

/** Capture on window: scroll does not bubble, and a call site that stops a press must not hide it. */
const WINDOW_LISTENER = { capture: true, passive: true }

/** Adds each listener to the window and returns the remover. */
function listenOnWindow(listeners: readonly (readonly [type: string, handler: (event: Event) => void])[]) {
  listeners.forEach(([type, handler]) => window.addEventListener(type, handler, WINDOW_LISTENER))
  return () => listeners.forEach(([type, handler]) => window.removeEventListener(type, handler, WINDOW_LISTENER))
}

/** Whether `event` is the window itself losing focus. The capture listener also hears every element's
 *  blur, which fires on each focus move. */
const isWindowBlur = (event: Event) => event.target === event.currentTarget

/** Whether `target` sits inside a tooltip trigger whose tip is open. Base UI stamps both attributes. */
const isOpenTipTrigger = (target: EventTarget | null) =>
  target instanceof Element && target.closest("[data-base-ui-tooltip-trigger][data-popup-open]") !== null

/** Runs `close` on every event that ends a tip's reason to show. Base UI closes on hover and focus
 *  leaving only, so the module adds the rest here. `close` must do nothing while no tip is open. */
function useTipDismissal(close: () => void) {
  const closeRef = React.useRef(close)
  React.useEffect(() => { closeRef.current = close })

  React.useEffect(() => {
    const dismiss = () => closeRef.current()
    return listenOnWindow([
      ...["scroll", "pointerdown", "contextmenu", "dragstart"].map((type) => [type, dismiss] as const),
      ["blur", (event) => { if (isWindowBlur(event)) dismiss() }],
      ["visibilitychange", () => { if (document.visibilityState === "hidden") dismiss() }],
      // Capture runs before the newly focused tip's own open, so a tab to another tipped control still opens it.
      ["focusin", ({ target }) => { if (!isOpenTipTrigger(target)) dismiss() }],
    ])
  }, [])
}

/** Tracks `pointerHeld` for the app. The provider calls it once, so a hand-built root unmounting mid-drag
 *  cannot end the hold. */
function usePointerHold() {
  React.useEffect(() => {
    const press = () => { pointerHeld = true }
    const release = () => { pointerHeld = false }
    // Blur too: a button released outside the window sends no pointerup here.
    const stop = listenOnWindow([
      ["pointerdown", press], ["pointerup", release], ["pointercancel", release],
      ["blur", (event) => { if (isWindowBlur(event)) release() }],
    ])
    return () => { stop(); release() }
  }, [])
}

/**
 * Mounted once at the application root. It owns tooltip timing for the whole app: every tip waits the
 * same beat, and once one is open its neighbors open with no wait at all. It also holds the one root and
 * popup every `Tip` shares, so an idle tip costs only its trigger.
 */
function TooltipProvider({ children }: { children: React.ReactNode }) {
  usePointerHold()
  useTipDismissal(() => { if (tipHandle.isOpen) tipHandle.close() })
  return (
    <TooltipPrimitive.Provider delay={TOOLTIP_DELAY_MS} timeout={TOOLTIP_DELAY_MS}>
      {children}
      <TooltipPrimitive.Root handle={tipHandle} onOpenChange={cancelHoverOpenWhileHeld}>
        {({ payload }) => payload && (
          <TooltipPrimitive.Portal>
            <TooltipPositioner side={payload.side} align={payload.align}>
              <TooltipPopup>{payload.tip}</TooltipPopup>
            </TooltipPositioner>
          </TooltipPrimitive.Portal>
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/** The root for a hand-built tip. It closes on every event that closes a `Tip`, and opens nothing on
 *  hover while a pointer button is held. */
function Tooltip<Payload = unknown>(
  { actionsRef, open, onOpenChange, ...props }: TooltipPrimitive.Root.Props<Payload>,
) {
  const ownActions = React.useRef<TooltipPrimitive.Root.Actions | null>(null)
  const actions = actionsRef ?? ownActions
  // Base UI's close() reports onOpenChange(false) even when closed, so the root tracks its own state.
  const openRef = React.useRef(props.defaultOpen ?? false)
  useTipDismissal(() => { if (open ?? openRef.current) actions.current?.close() })
  return (
    <TooltipPrimitive.Root
      actionsRef={actions}
      open={open}
      onOpenChange={(next, details) => {
        if (cancelHoverOpenWhileHeld(next, details)) return
        onOpenChange?.(next, details)
        if (!details.isCanceled) openRef.current = next
      }}
      {...props}
    />
  )
}

/** Joins many triggers to one `Tooltip` root, each trigger with its own payload. */
const createTooltipHandle = TooltipPrimitive.createHandle

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
        // pre-line: a tip that names an icon control puts its description on a second line.
        "max-w-64 whitespace-pre-line rounded-md border bg-popover px-2 py-1 text-helper text-popover-foreground shadow-md",
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
  /** Opens nothing while true, and keeps the control mounted, so a tip that comes and goes never moves focus. */
  disabled?: boolean
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
 *
 * The popup lives in `TooltipProvider`, so a tip with no provider above it never opens.
 */
function Tip({ tip, children, side = "top", align = "center", labelsChild, disabled }: TipProps) {
  const payload = React.useMemo(() => (tip ? { tip, side, align } : undefined), [tip, side, align])
  if (!payload) return children

  const childProps = children.props as { "aria-label"?: string; "aria-labelledby"?: string }
  const names = labelsChild ?? !(childProps["aria-label"] || childProps["aria-labelledby"])

  return (
    <TooltipPrimitive.Trigger
      handle={tipHandle}
      payload={payload}
      disabled={disabled}
      aria-label={names ? payload.tip : undefined}
      render={children}
    />
  )
}

/**
 * A tip that confirms an action at its control, such as **Copied** on a copy button. It shows `tip` at
 * `anchor` while `open` and fades out on close. Unlike `Tip` it opens on tap and on keyboard activation,
 * and a live region announces it.
 */
function FlashTip({ anchor, tip, open, side = "top" }: {
  anchor: React.RefObject<Element | null>
  tip: string
  open: boolean
  side?: TooltipPrimitive.Positioner.Props["side"]
}) {
  return (
    <>
      <span role="status" className="sr-only">{open ? tip : ""}</span>
      <TooltipPrimitive.Root open={open}>
        <TooltipPrimitive.Portal>
          <TooltipPositioner anchor={anchor} side={side}>
            <TooltipPopup data-flash-tip="">{tip}</TooltipPopup>
          </TooltipPositioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </>
  )
}

export {
  // eslint-disable-next-line react-refresh/only-export-components
  createTooltipHandle,
  FlashTip,
  Tip,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipPortal,
  TooltipPositioner,
  TooltipPopup,
}
