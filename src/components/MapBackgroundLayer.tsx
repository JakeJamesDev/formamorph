import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ViewportPortal, useStore } from '@xyflow/react';
import { RemoteImg } from '@/lib/useRemoteImage';
import { moveFrame, resizeFrame, type MapCorner } from '@/lib/mapBackground';
import { cn } from '@/lib/utils';
import type { MapFrame } from '@/types';

export type MapGesture = 'move' | 'resize';

const CORNERS: readonly MapCorner[] = ['nw', 'ne', 'sw', 'se'];
const CORNER_CURSOR: Record<MapCorner, string> = {
  nw: 'cursor-nwse-resize', se: 'cursor-nwse-resize', ne: 'cursor-nesw-resize', sw: 'cursor-nesw-resize',
};
/** A corner handle's edge on screen, whatever the zoom. */
const HANDLE_PX = 12;

/**
 * The Map Background in canvas space, so it pans and zooms with the boxes. It always draws behind every box.
 * Locked, it takes no pointer. While adjusting, a drag moves it and a corner resizes it at its aspect ratio,
 * each committed once on release.
 */
export function MapBackgroundLayer({ src, frame, opacity, adjust }: {
  src: string;
  frame: MapFrame;
  opacity: number;
  adjust?: { onCommit: (frame: MapFrame, gesture: MapGesture) => void };
}) {
  const zoom = useStore((s) => s.transform[2]);
  const [draft, setDraft] = useState<MapFrame | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  // Adjust ending mid-gesture, or an unmount, drops the window listeners and commits nothing.
  const adjusting = !!adjust;
  useEffect(() => {
    if (adjusting) return;
    stopRef.current?.();
    setDraft(null);
  }, [adjusting]);
  useEffect(() => () => stopRef.current?.(), []);
  const shown = draft ?? frame;

  const begin = (event: ReactPointerEvent, gesture: MapGesture, corner?: MapCorner) => {
    if (!adjust || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    const from = frame;
    let last = from;
    const move = (e: PointerEvent) => {
      const dx = (e.clientX - start.x) / zoom;
      const dy = (e.clientY - start.y) / zoom;
      last = gesture === 'move' || !corner ? moveFrame(from, dx, dy) : resizeFrame(from, corner, dx, dy);
      setDraft(last);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      stopRef.current = null;
    };
    const end = () => {
      stop();
      setDraft(null);
      if (last !== from) adjust.onCommit(last, gesture);
    };
    stopRef.current = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const handle = HANDLE_PX / zoom;
  const placed = { transform: `translate(${shown.x}px, ${shown.y}px)`, width: shown.width, height: shown.height };
  return (
    <ViewportPortal>
      {/* Behind every box and arrow; while adjusting, the canvas lets presses on the boxes fall through to it. */}
      <div
        data-map-background={adjust ? 'adjust' : 'locked'}
        className={cn('absolute left-0 top-0', adjust && 'nodrag nopan cursor-move')}
        style={{ ...placed, zIndex: -1, pointerEvents: adjust ? 'auto' : 'none' }}
        onPointerDown={(e) => begin(e, 'move')}
        onClick={(e) => e.stopPropagation()}
      >
        <RemoteImg src={src} alt="" draggable={false} className="h-full w-full select-none object-contain" style={{ opacity }} />
      </div>
      {/* The outline and corners sit above the boxes, so a box never covers a handle. */}
      {adjust && (
        <div
          data-map-background-handles
          className="nodrag nopan pointer-events-none absolute left-0 top-0 outline outline-2 outline-primary"
          style={{ ...placed, zIndex: 2000 }}
        >
          {CORNERS.map((corner) => (
            <span
              key={corner}
              data-map-corner={corner}
              className={cn('pointer-events-auto absolute rounded-sm border-2 border-primary bg-background', CORNER_CURSOR[corner])}
              style={{
                width: handle,
                height: handle,
                [corner.startsWith('n') ? 'top' : 'bottom']: -handle / 2,
                [corner.endsWith('w') ? 'left' : 'right']: -handle / 2,
              }}
              onPointerDown={(e) => begin(e, 'resize', corner)}
              onClick={(e) => e.stopPropagation()}
            />
          ))}
        </div>
      )}
    </ViewportPortal>
  );
}
