import { createContext, useContext } from 'react';
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type Modifier } from '@dnd-kit/core';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * The rules every editor drag obeys, in one place. `EditorDndContext` applies them; a surface that needs
 * different ones passes its own through that component rather than building a drag context of its own.
 * See `docs/adr/0007-editor-drag-invariants.md` for why each rule exists.
 */

/** px the pointer travels before a press becomes a drag, so a tap still selects the row it landed on. */
export const DRAG_ACTIVATION_DISTANCE = 5;

/** The house sensors: mouse or touch through one pointer sensor, plus keyboard sorting. */
export function useEditorSensors(activationDistance = DRAG_ACTIVATION_DISTANCE) {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: activationDistance } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

/**
 * Vertical lists: movement is Y-only and clamped to the scroll viewport. Without the clamp the in-flow
 * row is dragged past the last one, which grows the scroll height, so auto-scroll chases it into empty
 * space forever.
 */
export const VERTICAL_LIST_MODIFIERS: Modifier[] = [restrictToVerticalAxis, restrictToFirstScrollableAncestor];

/**
 * The same clamp for a depth-nesting tree, on Y alone.
 *
 * A tree reads the drag's horizontal delta as the row's nesting depth, and every stock bounding modifier
 * (`restrictToVerticalAxis`, `restrictToFirstScrollableAncestor`, `restrictToParentElement`) clamps that
 * delta as well — which silently turns re-parenting into plain reordering. Never give a tree one of those.
 */
export const restrictYToScrollAncestor: Modifier = ({ transform, draggingNodeRect, scrollableAncestorRects }) => {
  const rect = scrollableAncestorRects[0];
  if (!draggingNodeRect || !rect) return transform;
  let y = transform.y;
  if (draggingNodeRect.top + y < rect.top) y = rect.top - draggingNodeRect.top;
  else if (draggingNodeRect.bottom + y > rect.bottom) y = rect.bottom - draggingNodeRect.bottom;
  return { ...transform, y };
};

/** The id being dragged in the nearest `EditorDndContext`, or null when nothing is. */
export const DragActiveContext = createContext<string | null>(null);

/**
 * The id being dragged on this surface, for the few lists that change shape mid-drag — a virtualized list
 * pinning the carried row's index, a tree collapsing its groups. The suppressed hover state and the row
 * styling are already handled; a surface needs this only for behavior of its own.
 */
export const useEditorDragActive = (): string | null => useContext(DragActiveContext);
