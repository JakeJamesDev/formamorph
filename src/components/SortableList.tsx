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
import { GripVertical, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface SortableListItem {
  id: string;
  name: string;
}

/** One selectable, drag-reorderable list row: a grip, the item name, and duplicate/delete actions (plus an
 *  optional enabled checkbox). Shared by the World Editor's item lists and the standalone placeholder editor. */
export function SortableRow({
  item,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
  enabled,
  onToggleEnabled,
}: {
  item: SortableListItem;
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
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      className={`p-2 cursor-pointer rounded-md transition-colors flex justify-between items-center
        ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
    >
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`cursor-grab touch-none px-1 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {onToggleEnabled && (
        <Checkbox
          checked={enabled !== false}
          onCheckedChange={(v) => onToggleEnabled(item.id, v === true)}
          onClick={(e) => e.stopPropagation()}
          className="mx-1 shrink-0"
          title={enabled === false ? 'Disabled — click to enable' : 'Enabled — click to disable'}
        />
      )}
      <span className="flex-grow">{item.name}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onDuplicate(item.id); }}
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        title="Duplicate"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        title="Delete"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
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
