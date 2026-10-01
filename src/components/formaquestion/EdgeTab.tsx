import {
  forwardRef, useId, useLayoutEffect, useRef, useState,
  type ComponentPropsWithoutRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent,
} from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import {
  isArrowKey, isSideEdge, moveByKey, placeAt, readTabPlace, wholeOnScreen, writeTabPlace, type Edge, type TabPlace,
} from '@/lib/formaquestion/tabPlace';
import { viewportOf } from '@/lib/formaquestion/windowBox';
import { cn } from '@/lib/utils';

/** Pointer travel, in pixels, that turns a press into a move. Less than this is a click. */
const DRAG_THRESHOLD = 4;

/**
 * Shape and label direction per edge. The tab is flat against its edge and round on the inner side. The
 * label reads top to bottom on the right, bottom to top on the left, and left to right on the top and the
 * bottom, so it is never upside down.
 */
const EDGE_SHAPE: Record<Edge, { tab: string; label: string; tip: 'left' | 'right' | 'top' | 'bottom' }> = {
  right: { tab: 'flex-col rounded-r-none border-r-0 px-1.5 py-3', label: '[writing-mode:vertical-rl]', tip: 'left' },
  left: { tab: 'flex-col-reverse rounded-l-none border-l-0 px-1.5 py-3', label: 'rotate-180 [writing-mode:vertical-rl]', tip: 'right' },
  top: { tab: 'flex-row rounded-t-none border-t-0 px-3 py-1.5', label: '', tip: 'bottom' },
  bottom: { tab: 'flex-row rounded-b-none border-b-0 px-3 py-1.5', label: '', tip: 'top' },
};

/** The Help tab's look on one edge, with no place of its own. */
export const EdgeTabButton = forwardRef<HTMLButtonElement,
  ComponentPropsWithoutRef<typeof Button> & { edge: Edge; open: boolean }
>(({ edge, open, className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="outline"
    aria-expanded={open}
    data-fq-edge={edge}
    className={cn('h-auto select-none gap-1.5 shadow-md', EDGE_SHAPE[edge].tab, open && 'bg-accent text-accent-foreground', className)}
    {...props}
  >
    <CircleHelp aria-hidden className="h-4 w-4 shrink-0" />
    <span className={EDGE_SHAPE[edge].label}>Help</span>
  </Button>
));
EdgeTabButton.displayName = 'EdgeTabButton';

/**
 * The Formaquestion launcher: a tab that stays flat on the nearest screen edge. A press opens or closes
 * the window. A drag, or an arrow key while the tab has focus, moves it, and the device keeps its place.
 * Its edges are those of the visible area, so the on-screen keyboard moves it up with the app.
 */
export function EdgeTab({ open, concealed = false, controls, onToggle }: {
  open: boolean;
  /** Hides the tab and keeps its place, while the mobile sheet covers the screen. */
  concealed?: boolean;
  /** The id of the window the tab opens. */
  controls: string;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  // The tab owns its place, so a move re-renders the tab only.
  const [place, setPlace] = useState<TabPlace>(readTabPlace);
  const press = useRef<{ x: number; y: number; moved: boolean; length: number; latest?: TabPlace } | null>(null);
  const lastPressMoved = useRef(false);

  /** The tab's long side. It runs along the edge on every edge. */
  const tabLength = () => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? Math.max(rect.width, rect.height) : 0;
  };

  /** The visible area the tab sits on, and where it starts in the layout viewport. */
  const area = () => {
    const rect = areaRef.current?.getBoundingClientRect();
    return rect && rect.height > 0
      ? { left: rect.left, top: rect.top, viewport: { width: rect.width, height: rect.height } }
      : { left: 0, top: 0, viewport: viewportOf(window) };
  };

  // The tab stays whole on the screen when it first shows and when the browser window changes size.
  useLayoutEffect(() => {
    const fit = () => setPlace((current) => {
      const next = wholeOnScreen(current, tabLength(), area().viewport);
      return Math.abs(next.at - current.at) > 0.0005 ? next : current;
    });
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { x: event.clientX, y: event.clientY, moved: false, length: tabLength() };
    lastPressMoved.current = false;
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = press.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD) return;
    current.moved = true;
    const { left, top, viewport } = area();
    current.latest = wholeOnScreen(placeAt(event.clientX - left, event.clientY - top, viewport), current.length, viewport);
    setPlace(current.latest);
  };
  // The device keeps the place the player left the tab at.
  const onPointerEnd = () => {
    const ended = press.current;
    press.current = null;
    lastPressMoved.current = ended?.moved ?? false;
    if (ended?.latest) writeTabPlace(ended.latest);
  };
  // A move ends with a click on the tab, which must not open or close the window. A key press has no detail.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const moved = event.detail > 0 && lastPressMoved.current;
    lastPressMoved.current = false;
    if (!moved) onToggle();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!isArrowKey(event.key)) return;
    event.preventDefault();
    const next = moveByKey(place, event.key, tabLength(), area().viewport);
    if (next === place) return;
    setPlace(next);
    writeTabPlace(next);
  };

  const style: CSSProperties = isSideEdge(place.edge)
    ? { [place.edge]: 0, top: `${place.at * 100}%`, transform: 'translateY(-50%)' }
    : { [place.edge]: 0, left: `${place.at * 100}%`, transform: 'translateX(-50%)' };

  return (
    <div ref={areaRef} className="app-viewport pointer-events-none">
      <Tip tip="Opens or closes Formaquestion (F1). Drag the tab to move it." side={EDGE_SHAPE[place.edge].tip} labelsChild={false}>
        <EdgeTabButton
          ref={ref}
          edge={place.edge}
          open={open}
          aria-controls={controls}
          aria-describedby={hintId}
          aria-keyshortcuts="F1"
          data-fq-launcher=""
          onClick={onClick}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          style={concealed ? { ...style, visibility: 'hidden' } : style}
          className="pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing"
        />
      </Tip>
      <span id={hintId} className="sr-only">Press the arrow keys to move this tab</span>
    </div>
  );
}
