import type { DragEndEvent } from '@dnd-kit/core';
import type { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Sortable = ReturnType<typeof useSortable>;

/** A dragged row's style. Translate, not Transform: Transform scales the row to its target slot. */
export const dragStyle = ({ transform, transition, isDragging }: Pick<Sortable, 'transform' | 'transition' | 'isDragging'>) =>
  ({ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : undefined });

/** The from and to indexes of a drop in `items`, or null when nothing moved. */
export function droppedMove<T extends { id: string }>(items: readonly T[], { active, over }: DragEndEvent): [number, number] | null {
  if (!over || active.id === over.id) return null;
  const from = items.findIndex((it) => it.id === active.id);
  const to = items.findIndex((it) => it.id === over.id);
  return from === -1 || to === -1 ? null : [from, to];
}
