import * as React from "react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** How far the finger that opened the menu may drift before the hold reads as a drag instead. */
const DRAG_THRESHOLD_PX = 10

const OpenState = React.createContext<{ open: boolean; close: () => void }>({ open: false, close: () => {} })

/**
 * Radix's root, with the open state held here so the trigger can close it. Radix opens the menu after a
 * long press on touch and then leaves it up whatever the finger does next; on a phone that finger is
 * usually starting a drag, and the menu must give way to it exactly as a home-screen icon's does.
 */
const ContextMenu = ({ open: openProp, onOpenChange, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) => {
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }, [onOpenChange])
  const state = React.useMemo(() => ({ open, close: () => setOpen(false) }), [open, setOpen])
  return (
    <OpenState.Provider value={state}>
      <ContextMenuPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </OpenState.Provider>
  )
}

const ContextMenuTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Trigger>
>(({ onPointerDown, onPointerMove, ...props }, ref) => {
  const { open, close } = React.useContext(OpenState)
  // Where the finger landed. A touch pointer stays captured by the element it went down on, so its moves
  // keep arriving here even once the menu has put the rest of the page behind a modal layer.
  const downAt = React.useRef<{ x: number; y: number } | null>(null)
  return (
    <ContextMenuPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        downAt.current = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        const from = downAt.current
        if (!from || event.pointerType === 'mouse') return
        const drifted = Math.hypot(event.clientX - from.x, event.clientY - from.y) >= DRAG_THRESHOLD_PX
        if (open) {
          if (!drifted) return
          downAt.current = null
          close()
        } else if (!drifted) {
          // Radix cancels its long press on any move at all, and a held finger is never that still. A
          // prevented event skips Radix's own handler, so the hold survives the drift and a real move
          // still cancels it.
          event.preventDefault()
        }
      }}
      {...props}
    />
  )
})
ContextMenuTrigger.displayName = ContextMenuPrimitive.Trigger.displayName

/**
 * Eat the click that ends the press now closing the menu. Radix closes on the pointer-down, which
 * restores the page's pointer events in time for that press's click to land on whatever sat under it.
 * Native menus on every desktop eat that click too.
 */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    disarm()
  }
  // A tap's click follows its release within the frame; anything later is a new tap and goes through.
  const timer = window.setTimeout(() => disarm(), 500)
  const disarm = () => {
    window.clearTimeout(timer)
    document.removeEventListener('click', swallow, true)
  }
  document.addEventListener('click', swallow, true)
}

const ContextMenuGroup = ContextMenuPrimitive.Group

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, onPointerDownOutside, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 min-w-44 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      onPointerDownOutside={(event) => {
        onPointerDownOutside?.(event)
        // Only a primary press ends in a click. A right-click outside closes this menu and opens the next
        // one in the same press, and the click it would swallow is the author's first pick from that menu.
        if (!event.defaultPrevented && event.detail.originalEvent.button === 0) swallowNextClick()
      }}
      {...props}
    />
  </ContextMenuPrimitive.Portal>
))
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

/** Shared row chrome. The tick's column is held even by a plain action, so every label in one menu starts
 *  on the same line. */
const itemClass =
  "relative flex w-full cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-label outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:text-muted-foreground data-[disabled]:opacity-50"

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Item ref={ref} className={cn(itemClass, className)} {...props} />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

/** The indicator sits in flow rather than absolutely, so an unticked row indents exactly as far as a ticked
 *  one instead of relying on a reserved padding that drifts from the icon's real width. */
const Tick = ({ checked }: { checked?: boolean }) => (
  <Check className={cn("h-4 w-4 shrink-0", checked ? "opacity-100" : "opacity-0")} />
)

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(itemClass, className)}
    {...props}
  >
    <Tick checked={checked === true} />
    {children}
  </ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem> & { checked?: boolean }
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem ref={ref} className={cn(itemClass, className)} {...props}>
    <Tick checked={checked} />
    {children}
  </ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-meta text-muted-foreground", className)}
    {...props}
  />
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-hairline bg-border", className)} {...props} />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuGroup,
  ContextMenuRadioGroup,
}
