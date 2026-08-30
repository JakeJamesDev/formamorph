import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  DndContext, closestCenter,
  type CollisionDetection, type DndContextProps, type Modifier,
  type DragCancelEvent, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent,
  type SensorDescriptor, type SensorOptions,
} from '@dnd-kit/core';
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable';
import { CONTAINED_AUTO_SCROLL } from '@/lib/dndAutoScroll';
import { useSortableIds } from '@/lib/useSortableIds';
import { DragActiveContext, VERTICAL_LIST_MODIFIERS, useEditorSensors } from './dragInvariants';

/** No box of its own, so wrapping a surface never disturbs its layout. `pointer-events` still reaches
 *  the rows below, because it is inherited. */
const NO_BOX: CSSProperties = { display: 'contents' };

export interface EditorDndContextProps {
  /**
   * Replaces the house pointer + keyboard pair. Only for a surface whose gesture is genuinely different —
   * the library grid separates a mouse press from a long press on touch. `activationDistance` is ignored
   * when this is given.
   */
  sensors?: SensorDescriptor<SensorOptions>[];
  /** px the pointer must travel before a press becomes a drag. */
  activationDistance?: number;
  /** `closestCorners` where a list has drop zones between its rows; `pointerWithin` where the pointer
   *  itself picks the target. */
  collisionDetection?: CollisionDetection;
  /** Defaults to the vertical-list clamps. A depth-nesting tree must pass `restrictYToScrollAncestor`
   *  instead, and a 2D grid the scroll-ancestor clamp alone. */
  modifiers?: Modifier[];
  /** Defaults to scrolling only a real inner viewport. `false` for a strip that has none. */
  autoScroll?: DndContextProps['autoScroll'];
  measuring?: DndContextProps['measuring'];
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
  children: ReactNode;
}

/**
 * The drag context every sortable editor surface renders through.
 *
 * It carries the house rules — the activation distance, keyboard sorting, auto-scroll that stays inside
 * the list's own viewport, and hit-testing that goes dark for the length of a drag so nothing lights up
 * or pops a tooltip under the cursor. Drops are unaffected by that last one, because dnd-kit's collision
 * is rect-based rather than hit-tested.
 *
 * Everything a surface legitimately varies is a prop. Nothing here decides where a drop lands: each
 * surface keeps its own drag-end handler.
 *
 * One thing to watch at a call site: this renders a wrapper element that draws no box, so flex and grid
 * layout pass straight through it, but CSS that selects direct children does not. A list spaced by
 * `space-y-*` has to become `flex flex-col gap-*`, or its rows lose their gaps.
 */
export function EditorDndContext({
  sensors,
  activationDistance,
  collisionDetection = closestCenter,
  modifiers = VERTICAL_LIST_MODIFIERS,
  autoScroll = CONTAINED_AUTO_SCROLL,
  measuring,
  onDragStart,
  onDragMove,
  onDragOver,
  onDragEnd,
  onDragCancel,
  children,
}: EditorDndContextProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const houseSensors = useEditorSensors(activationDistance);

  return (
    <DndContext
      sensors={sensors ?? houseSensors}
      collisionDetection={collisionDetection}
      modifiers={modifiers}
      autoScroll={autoScroll}
      measuring={measuring}
      onDragStart={(event) => { setActiveId(String(event.active.id)); onDragStart?.(event); }}
      onDragMove={onDragMove}
      onDragOver={onDragOver}
      onDragEnd={(event) => { setActiveId(null); onDragEnd?.(event); }}
      onDragCancel={(event) => { setActiveId(null); onDragCancel?.(event); }}
    >
      <DragActiveContext.Provider value={activeId}>
        {/* The attribute one global rule reads to darken hit-testing (see `index.css`). */}
        <div style={NO_BOX} data-editor-dragging={activeId ? '' : undefined}>{children}</div>
      </DragActiveContext.Provider>
    </DndContext>
  );
}

/**
 * The sortable set inside an {@link EditorDndContext}, given the items themselves rather than an id array.
 *
 * Building that array at the call site is the one mistake this layer cannot catch any other way: dnd-kit
 * compares items by reference, so an inline `.map()` re-run on a mid-drag render replaces every displaced
 * row's slide with a snap. Here the ids are held at one reference for as long as the ids themselves hold.
 */
export function StableSortableContext<T>({ items, getId, strategy, children }: {
  items: readonly T[];
  /** How to read an item's id. Omit for items that are ids, or that carry `id`. */
  getId?: (item: T) => string;
  strategy?: SortingStrategy;
  children: ReactNode;
}) {
  const ids = useSortableIds(items, getId ?? defaultId);
  return <SortableContext items={ids} strategy={strategy}>{children}</SortableContext>;
}

/** An item is either its own id or carries one. Anything else names its accessor. */
function defaultId(item: unknown): string {
  return typeof item === 'string' ? item : String((item as { id: string }).id);
}
