import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { type ReactNode } from 'react';
import { Copy, X } from 'lucide-react';
import { EditorRow } from '@/components/EditorRow';

export interface SortableListItem {
  id: string;
  name: string;
}

/** One selectable, drag-reorderable list row: a grip, the item name, and duplicate/delete actions (plus an
 *  optional enabled checkbox). Shared by the World Editor's item lists and the standalone placeholder editor. */
export function SortableRow({
  item,
  label,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
  enabled,
  onToggleEnabled,
}: {
  item: SortableListItem;
  /** Overrides the rendered name — a node, so a name holding a placeholder can draw it as a chip. The
   *  plain `item.name` still names the row for screen readers and the delete confirmation. */
  label?: ReactNode;
  selected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  enabled?: boolean;
  onToggleEnabled?: (id: string, enabled: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const faded = !!onToggleEnabled && enabled === false;
  const style = {
    // Translate (not Transform): Transform bakes in a scale that resizes the dragged row to the target slot.
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging || faded ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={style}
      gripProps={{ ...attributes, ...listeners }}
      selected={selected}
      onSelect={() => onSelect(item.id)}
      checkbox={onToggleEnabled ? { checked: enabled !== false, onChange: (v) => onToggleEnabled(item.id, v) } : undefined}
      label={label ?? item.name}
      actions={[
        { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => onDuplicate(item.id) },
        { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => onRemove(item.id) },
      ]}
    />
  );
}

/** A vertical, drag-reorderable list of {@link SortableRow}s. Reorder is Y-only and clamped to the scroll
 *  viewport (autoscroll never runs the page). Empty-state is the caller's concern — pass a non-empty list. */
export function SortableList<T extends SortableListItem>({
  items,
  selectedId,
  onSelect,
  onRemove,
  onDuplicate,
  onReorder,
}: {
  items: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (next: T[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
      autoScroll={{
        canScroll: (el) =>
          el !== document.scrollingElement && el !== document.body && el !== document.documentElement,
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
              onRemove={onRemove}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
