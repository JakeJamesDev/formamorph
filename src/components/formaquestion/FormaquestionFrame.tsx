import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { CircleHelp, PanelLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FormaquestionMenu, type MenuActions } from './FormaquestionMenu';
import type { DragHandlers } from './usePointerDrag';

/**
 * The Formaquestion window's frame: a title bar that moves it, the Wide View toggle, the ⋮ menu, the Close
 * control, the content, and a corner grip that resizes it. The caller places it
 * and owns the moves. As a mobile sheet it has no frame lines and larger controls.
 */
export const FormaquestionFrame = forwardRef<HTMLElement, ComponentPropsWithoutRef<'section'> & {
  wide?: boolean;
  /** Shows the Wide View control. */
  onSwapWidth?: () => void;
  sheet?: boolean;
  menu: MenuActions;
  /** Where the menu renders: the layer that holds the window. */
  menuContainer?: HTMLElement;
  onClose: () => void;
  /** Pointer handlers for the title bar. */
  move?: DragHandlers;
  /** Pointer handlers for the corner grip. */
  resize?: DragHandlers;
  children: ReactNode;
}>(({ wide = false, onSwapWidth, sheet = false, menu, menuContainer, onClose, move, resize, className, children, ...props }, ref) => (
  <section
    ref={ref}
    role="dialog"
    aria-modal="false"
    aria-label="Formaquestion"
    tabIndex={-1}
    className={cn(
      'flex flex-col overflow-hidden bg-background text-foreground outline-none',
      sheet ? 'pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]' : 'rounded-lg border shadow-lg',
      className,
    )}
    {...props}
  >
    <header
      data-fq-drag=""
      {...move}
      // The sheet's 48px touch targets need room above and below, or their hover fill covers the border.
      className={cn('flex shrink-0 select-none items-center gap-2 border-b pl-3 pr-1', sheet ? 'h-14' : 'h-10', move && 'cursor-move touch-none')}
    >
      <CircleHelp aria-hidden className="h-4 w-4 text-muted-foreground" />
      <h2 className="text-label font-semibold">Formaquestion</h2>
      <div className="ml-auto flex items-center gap-1">
        {onSwapWidth && (
          <Tip tip="Wide View">
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={wide}
              onClick={onSwapWidth}
              className={cn('h-8 w-8', wide && 'bg-accent text-accent-foreground')}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </Tip>
        )}
        <FormaquestionMenu {...menu} container={menuContainer} large={sheet} />
        <Tip tip={sheet ? 'Close' : 'Close (F1)'}>
          <button
            type="button"
            aria-label="Close Formaquestion"
            onClick={onClose}
            className={cn(
              'inline-flex items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              sheet ? 'h-12 w-12' : 'h-8 w-8',
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </Tip>
      </div>
    </header>
    <div className="min-h-0 flex-1">{children}</div>
    {resize && <ResizeGrip resize={resize} />}
  </section>
));
FormaquestionFrame.displayName = 'FormaquestionFrame';

/** The bottom right corner grip that resizes the framed window or the minimal column. */
export function ResizeGrip({ resize, className }: { resize: DragHandlers; className?: string }) {
  return (
    <div data-fq-resize="" aria-hidden {...resize} className={cn('absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none', className)}>
      <span className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-muted-foreground/60" />
    </div>
  );
}
