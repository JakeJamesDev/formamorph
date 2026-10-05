import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { CircleHelp, PanelLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import { RESIZE_HANDLES, type ResizeHandle } from '@/lib/formaquestion/windowBox';
import { FormaquestionMenu, type MenuActions } from './FormaquestionMenu';
import { useHoverReveal } from './usePillFade';
import type { DragHandlers } from './usePointerDrag';

/** Pointer handlers for each resize handle. */
export type ResizeHandlers = Readonly<Record<ResizeHandle, DragHandlers>>;

/**
 * The Formaquestion window's frame: a title bar that moves it, the Wide View toggle, the ⋮ menu, the Close
 * control, the content, and the handles on its sides and corners that resize it. The caller places it
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
  /** Pointer handlers for the resize handles. */
  resize?: ResizeHandlers;
  children: ReactNode;
}>(({ wide = false, onSwapWidth, sheet = false, menu, menuContainer, onClose, move, resize, className, children, ...props }, ref) => (
  <section
    ref={ref}
    role="dialog"
    aria-modal="false"
    aria-label="Formaquestion"
    tabIndex={-1}
    className={cn(
      'flex flex-col bg-background text-foreground outline-none',
      // The handles straddle the frame's edges, so the frame itself clips nothing; its body clips to the rounded corners.
      sheet ? 'overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]' : 'rounded-lg border shadow-lg',
      className,
    )}
    {...props}
  >
    <div className={cn('flex min-h-0 flex-1 flex-col', !sheet && 'overflow-hidden rounded-lg')}>
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
    </div>
    {resize && <ResizeHandles resize={resize} />}
  </section>
));
FormaquestionFrame.displayName = 'FormaquestionFrame';

const CORNERS: readonly ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
const SIDES: readonly ResizeHandle[] = ['n', 'e', 's', 'w'];

/** Each handle's drag area: a strip that straddles its edge, or a square that straddles its corner. */
const HANDLE_PLACE: Record<ResizeHandle, string> = {
  n: '-top-1 left-3 right-3 h-2 cursor-ns-resize',
  s: '-bottom-1 left-3 right-3 h-2 cursor-ns-resize',
  e: '-right-1 bottom-3 top-3 w-2 cursor-ew-resize',
  w: '-left-1 bottom-3 top-3 w-2 cursor-ew-resize',
  nw: '-left-1 -top-1 h-4 w-4 cursor-nwse-resize',
  ne: '-right-1 -top-1 h-4 w-4 cursor-nesw-resize',
  sw: '-bottom-1 -left-1 h-4 w-4 cursor-nesw-resize',
  se: '-bottom-1 -right-1 h-4 w-4 cursor-nwse-resize',
};
/** Each handle's mark: a short bar on the edge, or an L that opens toward the box. */
const HANDLE_MARK: Record<ResizeHandle, string> = {
  n: 'left-1/2 top-[3px] h-0.5 w-6 -translate-x-1/2 bg-muted-foreground/60',
  s: 'bottom-[3px] left-1/2 h-0.5 w-6 -translate-x-1/2 bg-muted-foreground/60',
  e: 'right-[3px] top-1/2 h-6 w-0.5 -translate-y-1/2 bg-muted-foreground/60',
  w: 'left-[3px] top-1/2 h-6 w-0.5 -translate-y-1/2 bg-muted-foreground/60',
  nw: 'left-1 top-1 h-2 w-2 border-l-2 border-t-2 border-muted-foreground/60',
  ne: 'right-1 top-1 h-2 w-2 border-r-2 border-t-2 border-muted-foreground/60',
  sw: 'bottom-1 left-1 h-2 w-2 border-b-2 border-l-2 border-muted-foreground/60',
  se: 'bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-muted-foreground/60',
};

/**
 * The handles that resize the framed window or the minimal column: one on each side, which moves that edge, and one
 * on each corner, which moves both. A mark shows while the pointer is near its handle and fades after the pill's
 * delay. A touch screen has no hover, so its corner marks stay up and its side marks stay hidden.
 */
export function ResizeHandles({ resize, className }: { resize: ResizeHandlers; className?: string }) {
  const touch = useMediaQuery('(pointer: coarse)');
  const reveal = useHoverReveal<ResizeHandle>(touch ? CORNERS : [], touch ? SIDES : []);
  return (
    <>
      {RESIZE_HANDLES.map((handle) => {
        const { className: markClass, onPointerEnter, onPointerLeave, ...mark } = reveal(handle);
        return (
          <div
            key={handle}
            data-fq-resize={handle}
            aria-hidden
            {...resize[handle]}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            className={cn('absolute z-10 touch-none', HANDLE_PLACE[handle], className)}
          >
            <span {...mark} className={cn('absolute', HANDLE_MARK[handle], markClass)} />
          </div>
        );
      })}
    </>
  );
}
