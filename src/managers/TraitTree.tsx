import { useMemo, useState } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { X, GripVertical, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import {
  DndContext, pointerWithin, PointerSensor, KeyboardSensor, useSensor, useSensors,
  DragOverlay, type DragStartEvent, type DragMoveEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  buildTraitTree, flattenTraitTree, removeChildrenOf, getTraitDropProjection, applyTraitDrop,
  type FlatTraitNode,
} from '@/lib/traitTree';

const INDENT = 24; // px per nesting level — also the horizontal drag distance to change depth

interface RowCtx {
  selectedId: string | null;
  onSelect: (id: string) => void;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  removeTrait: (id: string) => void;
  removeGroup: (id: string) => void;
}

/** One flat row (trait or group header) with a depth-based left indent. */
function TreeRow({
  node, depth, ctx, overlay = false,
}: { node: FlatTraitNode; depth: number; ctx: RowCtx; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  // The dragged row's indent is shown via paddingLeft (projected depth), so pin its x-translate to 0 —
  // it slides vertically only, matching the overlay. Sibling rows keep their full transform (the
  // reorder shift animation). The DragOverlay is the element that actually follows the cursor.
  const rowTransform = isDragging && !overlay && transform ? { ...transform, x: 0 } : transform;
  const style = {
    transform: CSS.Transform.toString(rowTransform),
    transition,
    paddingLeft: depth * INDENT,
    opacity: isDragging && !overlay ? 0.4 : 1,
  };
  const selected = ctx.selectedId === node.id;
  const rowClass = `p-2 cursor-pointer rounded-md transition-colors flex items-center gap-1
    ${overlay ? 'bg-secondary shadow-lg' : selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`;
  const isGroup = node.kind === 'group';
  const isCollapsed = isGroup && ctx.collapsed.has(node.id);

  return (
    <div ref={setNodeRef} style={style} onClick={() => ctx.onSelect(node.id)} className={rowClass}>
      {isGroup ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); ctx.toggleCollapse(node.id); }}
          className="shrink-0"
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      ) : null}
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`cursor-grab touch-none px-1 ${selected && !overlay ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        title="Drag to reorder or nest"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {isGroup ? <Folder className="h-4 w-4 shrink-0" /> : null}
      <span className={`flex-grow ${isGroup ? 'font-medium' : ''}`}>
        {isGroup ? node.group?.name : node.trait?.name}
      </span>
      {!overlay && (
        <Button
          variant="ghost"
          size="icon"
          className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
          onClick={(e) => { e.stopPropagation(); if (isGroup) ctx.removeGroup(node.id); else ctx.removeTrait(node.id); }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** The Traits tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. */
const TraitTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { traits, traitGroups, setTraits, setTraitGroups, removeTrait, removeTraitGroup } = useGameData();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Visible rows: full tree minus collapsed groups' children and (while dragging) the dragged subtree.
  const visible = useMemo(() => {
    const full = flattenTraitTree(buildTraitTree(traitGroups, traits));
    return removeChildrenOf(full, activeId ? [...collapsed, activeId] : collapsed);
  }, [traitGroups, traits, collapsed, activeId]);

  const projected = activeId && overId
    ? getTraitDropProjection(visible, activeId, overId, offsetLeft, INDENT)
    : null;
  const activeNode = activeId ? visible.find((n) => n.id === activeId) ?? null : null;

  const reset = () => { setActiveId(null); setOverId(null); setOffsetLeft(0); };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(String(active.id));
  };
  const handleDragMove = ({ delta }: DragMoveEvent) => setOffsetLeft(delta.x);
  const handleDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) {
      const next = applyTraitDrop(
        traitGroups, traits, collapsed, String(active.id), String(over.id), offsetLeft, INDENT,
      );
      if (next.groups !== traitGroups) setTraitGroups(next.groups);
      if (next.traits !== traits) setTraits(next.traits);
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
    removeTrait,
    removeGroup: removeTraitGroup,
  };

  if (!traits.length && !traitGroups.length) {
    return <p className="text-sm text-muted-foreground p-2">No traits yet — use the + button to add a group or trait.</p>;
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
      {/* Overlay moves vertically only (x pinned) and sits at the projected depth, so its indent
          snaps in INDENT steps to where it will drop instead of drifting freely. DndContext stays
          modifier-free so the pointer's delta.x still drives depth detection. */}
      <DragOverlay modifiers={[restrictToVerticalAxis]}>
        {activeNode ? (
          <TreeRow node={activeNode} depth={projected ? projected.depth : activeNode.depth} ctx={ctx} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default TraitTree;
