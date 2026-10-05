import { useEffect, useRef, type HTMLAttributes, type PointerEvent } from 'react';

export type DragHandlers = Required<Pick<HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>>;

/** Where the pointer is during a drag. */
export interface DragPoint {
  readonly clientX: number;
  readonly clientY: number;
}

/** What a drag does with one press. `start` returns null to ignore the press. */
export interface PointerDrag<Press> {
  start: (event: PointerEvent<HTMLElement>) => Press | null;
  move: (press: Press, point: DragPoint) => void;
  /** `canceled` is true when the browser took the pointer, such as for a scroll, rather than the player letting go. */
  end: (press: Press, canceled: boolean) => void;
}

/**
 * Tracks one press from pointer down to release. The window carries the moves and the release, so a drag ends
 * wherever the pointer lets go, even after the pressed element remounts, as the Mascot does when her side flips.
 * A press on content that a child renders elsewhere in the DOM, such as a menu, reaches the handlers through the
 * React tree and is ignored.
 */
export function usePointerDrag<Press>({ start, move, end }: PointerDrag<Press>): DragHandlers {
  const press = useRef<Press | null>(null);
  const pointerId = useRef<number | null>(null);
  const latest = useRef({ move, end });
  latest.current = { move, end };
  const detach = useRef<() => void>(() => {});
  const release = (canceled: boolean) => {
    detach.current();
    const ended = press.current;
    press.current = null;
    pointerId.current = null;
    if (ended !== null) latest.current.end(ended, canceled);
  };
  useEffect(() => () => detach.current(), []);
  return {
    onPointerDown: (event) => {
      if (!event.currentTarget.contains(event.target as Node)) return;
      if (press.current !== null) return;
      const next = start(event);
      if (next === null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      press.current = next;
      pointerId.current = event.pointerId;
      const onMove = (native: globalThis.PointerEvent) => {
        if (press.current !== null && native.pointerId === pointerId.current) latest.current.move(press.current, native);
      };
      const onUp = (native: globalThis.PointerEvent) => { if (native.pointerId === pointerId.current) release(false); };
      const onCancel = (native: globalThis.PointerEvent) => { if (native.pointerId === pointerId.current) release(true); };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      detach.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        detach.current = () => {};
      };
    },
    // The window listeners carry the drag; these keep the element's own events from reaching anything under it.
    onPointerMove: () => {},
    onPointerUp: () => {},
    onPointerCancel: () => {},
  };
}
