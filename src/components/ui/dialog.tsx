import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { ignoreLayerDismiss, keepLayerFocus } from "@/components/ui/shielded-layer"
import { SurfaceLayer, type SurfaceIdName } from "@/components/ui/surface"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-dim-layer=""
    className={cn(
      "fixed inset-0 z-50 bg-overlay/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * Shell classes for a dialog that fills the viewport. It anchors to the top rather than the center a
 * normal dialog uses: a full-height shell is already flush with both edges, and centering means the
 * on-screen keyboard shrinking the viewport slides the header down and back as it opens and closes.
 * Height tracks the keyboard-aware `--app-h` (see `viewportHeight.ts`).
 */
export const dialogFullHeight = 'top-[var(--app-top,0px)] translate-y-0 h-[var(--app-h,100dvh)]';

/**
 * Keeps a full-screen box's contents and close button clear of the status bar, cutout and gesture bar.
 * A transparent border rather than padding, so it adds to the caller's padding and moves absolute children too.
 */
export const dialogSafeArea = 'border-x-0 border-y-transparent border-t-[length:env(safe-area-inset-top)] border-b-[length:env(safe-area-inset-bottom)]';

/** On the desktop flag, a centered dialog centers below the header line, and a taller one sits at the line. */
const WINDOW_BUTTON_ROOM = '[[data-window-overlay]_&]:top-[var(--header-line)] [[data-window-overlay]_&]:translate-y-[max(0px,calc((var(--app-h,100dvh)-2*var(--header-line))/2-50%))]';

/** On mobile, a centered dialog centers between the status bar and the gesture bar, and a taller one sits below the status bar. */
const SAFE_AREA_ROOM = 'max-sm:top-[calc(var(--app-top,0px)+env(safe-area-inset-top))] max-sm:translate-y-[max(0px,calc((var(--app-h,100dvh)-env(safe-area-inset-top)-env(safe-area-inset-bottom))/2-50%))]';

const closeButtonBase = 'absolute inline-flex h-11 w-11 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground';

/** The full-screen window's button: a 44px target whose 20px icon centers 24px from the corner, and on the header line at `md` and wider. */
export const dialogCornerButton = `${closeButtonBase} right-[calc(0.125rem+var(--window-buttons-width))] top-0.5 md:top-1.5`;

/**
 * The close button: a 44px target centered on the title line of a `p-6` dialog, its 20px icon flush with
 * the content's right edge. A row beside it takes `pr-8` to clear the target.
 */
const dialogCloseButton = `${closeButtonBase} right-3 top-[11px]`;

/** For a control in the title line: the title sets the line's height, so the control stays centered on the close button. */
export const dialogTitleControl = '-my-4';

/** A title with controls beside it. Every sibling takes `dialogTitleControl`, and the line clears the close button. */
export const dialogTitleRow = 'flex min-h-[1.125rem] items-center pr-8 [&>:not(h2)]:-my-4';

/** A bordered header on a `p-0` dialog. With `dialogHeaderBarTitle`, its first line sits on the close button's center. */
export const dialogHeaderBar = 'border-b px-6 py-[11px]';

/** The title in a `dialogHeaderBar`. The tall line box also keeps `truncate` from cropping descenders. */
export const dialogHeaderBarTitle = 'leading-[2.75rem]';

/** The same, applied only below the `sm` breakpoint — for dialogs that keep a window on wider screens. */
export const dialogFullHeightMobile = 'max-sm:top-[var(--app-top,0px)] max-sm:translate-y-0 max-sm:h-[var(--app-h,100dvh)] max-sm:border-x-0 max-sm:border-y-transparent max-sm:border-t-[length:env(safe-area-inset-top)] max-sm:border-b-[length:env(safe-area-inset-bottom)]';

/**
 * The stock open/close animation minus the slide, for a dialog centered by its margins rather than by
 * `translate(-50%, -50%)`. The slide is written as a half-width offset that is correct only for a
 * transform-centered dialog; the zoom and fade read the same either way.
 *
 * Pair with `unanimated` on the content, and control it with `data-state` on the element itself.
 */
export const dialogCenteredAnimation = 'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95';

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean;
    /** Drop the stock zoom-and-fade so the caller can animate the box itself — a transform of its own
     *  would otherwise be overwritten frame by frame by the one these classes are running. */
    unanimated?: boolean;
    /** Extra classes for the dim sheet behind the box, for callers that pace its fade themselves. */
    overlayClassName?: string;
    /** The surface id this dialog reports while it is open. */
    surface?: SurfaceIdName;
    /** `own` keeps a box the caller places itself, such as a full-height shell, off the header-line room. */
    placement?: 'centered' | 'own';
  }
>(({ className, children, hideClose = false, unanimated = false, overlayClassName, surface, placement = 'centered', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg grid-cols-[minmax(0,1fr)] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
        placement === 'centered' && WINDOW_BUTTON_ROOM,
        placement === 'centered' && SAFE_AREA_ROOM,
        !unanimated && "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      {...props}
      // The shielded layer counts as inside the dialog: a press or Escape there does not close it, and a
      // closing dialog does not take focus from it.
      onPointerDownOutside={ignoreLayerDismiss(props.onPointerDownOutside)}
      onInteractOutside={ignoreLayerDismiss(props.onInteractOutside)}
      onEscapeKeyDown={ignoreLayerDismiss(props.onEscapeKeyDown)}
      onCloseAutoFocus={keepLayerFocus(props.onCloseAutoFocus)}>
      <SurfaceLayer id={surface}>{children}</SurfaceLayer>
      {!hideClose && (
        <DialogPrimitive.Close className={dialogCloseButton}>
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-title font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-helper text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
