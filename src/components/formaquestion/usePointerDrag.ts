import { useRef, type HTMLAttributes, type PointerEvent } from 'react';

export type DragHandlers = Required<Pick<HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>>;

/** What a drag does with one press. `start` returns null to ignore the press. */
export interface PointerDrag<Press> {
  start: (event: PointerEvent<HTMLElement>) => Press | null;
  move: (press: Press, event: PointerEvent<HTMLElement>) => void;
  end: (press: Press) => void;
}

/** Tracks one press from pointer down to release, with the pointer captured. */
export function usePointerDrag<Press>({ start, move, end }: PointerDrag<Press>): DragHandlers {
  const press = useRef<Press | null>(null);
  const release = () => {
    const ended = press.current;
    press.current = null;
    if (ended !== null) end(ended);
  };
  return {
    onPointerDown: (event) => {
      const next = start(event);
      if (next === null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      press.current = next;
    },
    onPointerMove: (event) => {
      if (press.current !== null) move(press.current, event);
    },
    onPointerUp: release,
    onPointerCancel: release,
  };
}
