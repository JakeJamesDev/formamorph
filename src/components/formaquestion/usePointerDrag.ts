import { useRef, type HTMLAttributes, type PointerEvent } from 'react';

export type DragHandlers = Required<Pick<HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>>;

/** What a drag does with one press. `start` returns null to ignore the press. */
export interface PointerDrag<Press> {
  start: (event: PointerEvent<HTMLElement>) => Press | null;
  move: (press: Press, event: PointerEvent<HTMLElement>) => void;
  /** `canceled` is true when the browser took the pointer, such as for a scroll, rather than the player letting go. */
  end: (press: Press, canceled: boolean) => void;
}

/**
 * Tracks one press from pointer down to release, with the pointer captured. A press on content that a child
 * renders elsewhere in the DOM, such as a menu, reaches the handlers through the React tree and is ignored.
 */
export function usePointerDrag<Press>({ start, move, end }: PointerDrag<Press>): DragHandlers {
  const press = useRef<Press | null>(null);
  const release = (canceled: boolean) => {
    const ended = press.current;
    press.current = null;
    if (ended !== null) end(ended, canceled);
  };
  return {
    onPointerDown: (event) => {
      if (!event.currentTarget.contains(event.target as Node)) return;
      const next = start(event);
      if (next === null) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      press.current = next;
    },
    onPointerMove: (event) => {
      if (press.current !== null) move(press.current, event);
    },
    onPointerUp: () => release(false),
    onPointerCancel: () => release(true),
  };
}
