/**
 * How a continuous control tells the open world that a press-to-release drag is one undo Step. The world
 * provider supplies the groups. With none, as on the account site or in a library editor, a press does
 * nothing. This file imports nothing from the app, so the slider and color picker stay leaves.
 */
import { createContext, useCallback, useContext, type PointerEvent } from 'react';

export interface GestureGroups {
  begin(): void;
  end(): void;
}

export const GestureGroupContext = createContext<GestureGroups | null>(null);

/** A pointer-down handler: everything the control writes until the pointer is released is one Step. */
export function useGestureStart(): (event: PointerEvent) => void {
  const groups = useContext(GestureGroupContext);
  return useCallback((event: PointerEvent) => {
    if (!groups || event.button !== 0) return;
    groups.begin();
    // On the window: a drag can be released anywhere, or end when the window loses focus mid-drag.
    const ends = ['pointerup', 'pointercancel', 'blur'] as const;
    const end = () => {
      for (const type of ends) window.removeEventListener(type, end, true);
      groups.end();
    };
    for (const type of ends) window.addEventListener(type, end, true);
  }, [groups]);
}
