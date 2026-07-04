import { useMemo, useState } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { X, GripVertical, ChevronRight, ChevronDown, Copy } from 'lucide-react';
import {
  DndContext, pointerWithin, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragStartEvent, type DragMoveEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  buildLocationTree, flattenLocationTree, removeCollapsedChildren, getLocationDropProjection,
  applyLocationDrop, removeLocationPromotingChildren, type FlatLocationNode,
} from '@/lib/locationTree';

const INDENT = 24; // px per nesting level — also the horizontal drag distance to change depth

interface RowCtx {
  selectedId: string | null;
  onSelect: (id: string) => void;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  hasChildren: (id: string) => boolean;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
}

/** One flat location row with a depth-based left indent; the chevron shows only when it has children. */
function TreeRow({ node, depth, ctx }: { node: FlatLocationNode; depth: number; ctx: RowCtx }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  // Pin the dragged row's x-translate to 0 — it slides vertically only while the pointer's horizontal delta
  // drives depth; its indent is shown via paddingLeft (projected depth).
  const rowTransform = isDragging && transform ? { ...transform, x: 0 } : transform;
  const style = {
    transform: CSS.Transform.toString(rowTransform),
    transition,
    paddingLeft: depth * INDENT,
    opacity: isDragging ? 0.5 : 1,
  };
  const selected = ctx.selectedId === node.id;
  const rowClass = `p-2 cursor-pointer rounded-md transition-colors flex items-center gap-1
    ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`;
  const hasChildren = ctx.hasChildren(node.id);
  const isCollapsed = ctx.collapsed.has(node.id);

  return (
    <div ref={setNodeRef} style={style} onClick={(e) => { e.stopPropagation(); ctx.onSelect(node.id); }} className={rowClass}>
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); ctx.toggleCollapse(node.id); }}
          className="shrink-0"
          aria-label={isCollapsed ? 'Expand sub-locations' : 'Collapse sub-locations'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      ) : (
        <span className="w-4 shrink-0" aria-hidden="true" />
      )}
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`cursor-grab touch-none px-1 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        title="Drag to reorder or nest"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="flex-grow">{node.location.name}</span>
      <Button
        variant="ghost"
        size="icon"
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        onClick={(e) => { e.stopPropagation(); ctx.duplicate(node.id); }}
        title="Duplicate"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        onClick={(e) => { e.stopPropagation(); ctx.remove(node.id); }}
        title="Delete"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** The Locations tab's sub-location tree: a flat sortable list where horizontal drag sets nesting depth. */
const LocationTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { locations, setLocations } = useGameData();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Ids that are a parent of at least one location — drives the chevron (from the full list, so a
  // collapsed node still shows its expand chevron).
  const parentIds = useMemo(
    () => new Set(locations.map((l) => l.parentId ?? null).filter((p): p is string => p !== null)),
    [locations],
  );

  // Visible rows: full tree minus collapsed nodes' children and (while dragging) the dragged subtree.
  const visible = useMemo(() => {
    const full = flattenLocationTree(buildLocationTree(locations));
    return removeCollapsedChildren(full, activeId ? [...collapsed, activeId] : collapsed);
  }, [locations, collapsed, activeId]);

  const projected = activeId && overId
    ? getLocationDropProjection(visible, activeId, overId, offsetLeft, INDENT)
    : null;

  const reset = () => { setActiveId(null); setOverId(null); setOffsetLeft(0); };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(String(active.id));
  };
  const handleDragMove = ({ delta }: DragMoveEvent) => setOffsetLeft(delta.x);
  const handleDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) {
      const next = applyLocationDrop(locations, collapsed, String(active.id), String(over.id), offsetLeft, INDENT);
      if (next !== locations) setLocations(next);
    }
    reset();
  };

  const ctx: RowCtx = {
    selectedId,
    onSelect,
    collapsed,
    toggleCollapse: (id) => setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    }),
    hasChildren: (id) => parentIds.has(id),
    remove: (id) => setLocations(removeLocationPromotingChildren(locations, id)),
    duplicate: (id) => {
      const index = locations.findIndex((l) => l.id === id);
      if (index === -1) return;
      const copy = { ...structuredClone(locations[index]), id: crypto.randomUUID() };
      copy.name = `${copy.name} (Copy)`;
      setLocations([...locations.slice(0, index + 1), copy, ...locations.slice(index + 1)]);
      onSelect(copy.id);
    },
  };

  if (!locations.length) {
    return <p className="text-sm text-muted-foreground p-2">No locations yet — use the + button to add one.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <SortableContext items={visible.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        {visible.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            depth={node.id === activeId && projected ? projected.depth : node.depth}
            ctx={ctx}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
};

export default LocationTree;
