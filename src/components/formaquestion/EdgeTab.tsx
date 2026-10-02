import {
  forwardRef, useId, useLayoutEffect, useRef, useState,
  type ComponentPropsWithoutRef, type CSSProperties, type KeyboardEvent, type MouseEvent,
} from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import {
  isArrowKey, isSideEdge, moveByKey, placeAt, readTabPlace, wholeOnScreen, writeTabPlace, type Edge, type TabPlace,
} from '@/lib/formaquestion/tabPlace';
import { viewportOf } from '@/lib/formaquestion/windowBox';
import { cn } from '@/lib/utils';
import { usePointerDrag } from './usePointerDrag';

/** Pointer travel, in pixels, that turns a press into a move. Less than this is a click. */
const DRAG_THRESHOLD = 4;

/** Shape and label direction per edge: flat against the edge, and the label never upside down. */
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

/** The Formaquestion launcher: a tab on the nearest edge of the visible area that opens the window and moves by drag or arrow key. */
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

  // The tab stays whole on the screen at first show, on a resize, and when the on-screen keyboard shows.
  useLayoutEffect(() => {
    const fit = () => setPlace((current) => {
      const next = wholeOnScreen(current, tabLength(), area().viewport);
      return Math.abs(next.at - current.at) > 0.0005 ? next : current;
    });
    // The app measures the visible area on the same event, so the tab reads it a frame later.
    let frame = 0;
    const fitNextFrame = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fitNextFrame);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fitNextFrame);
      cancelAnimationFrame(frame);
    };
  }, []);

  const pressHandlers = usePointerDrag<{ x: number; y: number; moved: boolean; length: number; latest?: TabPlace }>({
    start: (event) => {
      if (event.button !== 0) return null;
      lastPressMoved.current = false;
      return { x: event.clientX, y: event.clientY, moved: false, length: tabLength() };
    },
    move: (press, event) => {
      if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
      press.moved = true;
      const { left, top, viewport } = area();
      press.latest = wholeOnScreen(placeAt(event.clientX - left, event.clientY - top, viewport), press.length, viewport);
      setPlace(press.latest);
    },
    // The device keeps the place the player left the tab at.
    end: (press) => {
      lastPressMoved.current = press.moved;
      if (press.latest) writeTabPlace(press.latest);
    },
  });
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
          {...pressHandlers}
          style={concealed ? { ...style, visibility: 'hidden' } : style}
          className="pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing"
        />
      </Tip>
      <span id={hintId} className="sr-only">Press the arrow keys to move this tab</span>
    </div>
  );
}
