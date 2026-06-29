import { useMemo, useState } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Button } from '@/components/ui/button';
import { X, GripVertical, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { buildTraitTree, moveNode, type TraitTreeNode } from '@/lib/traitTree';

/** Shared row context, passed down the recursion to avoid re-creating components each render. */
interface TreeCtx {
  selectedId: string | null;
  onSelect: (id: string) => void;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  removeTrait: (id: string) => void;
  removeGroup: (id: string) => void;
}

/** A droppable list of sibling nodes (the root, or a group's direct children). */
function Container({ parentId, nodes, ctx }: { parentId: string | null; nodes: TraitTreeNode[]; ctx: TreeCtx }) {
  const { setNodeRef } = useDroppable({ id: `container:${parentId ?? 'root'}` });
  return (
    <div ref={setNodeRef} className="min-h-[8px]">
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        {nodes.map((node) => <TreeRow key={node.id} node={node} ctx={ctx} />)}
      </SortableContext>
    </div>
  );
}

/** A single trait row, or a group folder header plus its (recursive) children container. */
function TreeRow({ node, ctx }: { node: TraitTreeNode; ctx: TreeCtx }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  const selected = ctx.selectedId === node.id;
  const rowClass = `p-2 cursor-pointer rounded-md transition-colors flex items-center gap-1
    ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`;

  const grip = (
    <span
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className={`cursor-grab touch-none px-1 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
      title="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </span>
  );

  if (node.kind === 'trait') {
    return (
      <div ref={setNodeRef} style={style} onClick={() => ctx.onSelect(node.id)} className={rowClass}>
        {grip}
        <span className="flex-grow">{node.trait.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
          onClick={(e) => { e.stopPropagation(); ctx.removeTrait(node.id); }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const isCollapsed = ctx.collapsed.has(node.id);
  return (
    <div>
      <div ref={setNodeRef} style={style} onClick={() => ctx.onSelect(node.id)} className={rowClass}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); ctx.toggleCollapse(node.id); }}
          className="shrink-0"
          aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {grip}
        <Folder className="h-4 w-4 shrink-0" />
        <span className="flex-grow font-medium">{node.group.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
          onClick={(e) => { e.stopPropagation(); ctx.removeGroup(node.id); }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {!isCollapsed && (
        <div className="ml-4 border-l border-border pl-2">
          <Container parentId={node.id} nodes={node.children} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

/** The Traits tab's folder tree: nestable groups + traits, drag to reorder/regroup. */
const TraitTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { traits, traitGroups, setTraits, setTraitGroups, removeTrait, removeTraitGroup } = useGameData();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tree = useMemo(() => buildTraitTree(traitGroups, traits), [traitGroups, traits]);

  const parentOf = (id: string): string | null => {
    const g = traitGroups.find((x) => x.id === id);
    if (g) return g.parentId ?? null;
    return traits.find((x) => x.id === id)?.groupId ?? null;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    let newParentId: string | null;
    let beforeId: string | null;
    if (overId.startsWith('container:')) {
      const raw = overId.slice('container:'.length);
      newParentId = raw === 'root' ? null : raw;
      beforeId = null;
    } else {
      newParentId = parentOf(overId);
      beforeId = overId;
    }

    const next = moveNode(traitGroups, traits, activeId, newParentId, beforeId);
    if (next.groups !== traitGroups) setTraitGroups(next.groups);
    if (next.traits !== traits) setTraits(next.traits);
  };

  const ctx: TreeCtx = {
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
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToFirstScrollableAncestor]}
    >
      <Container parentId={null} nodes={tree} ctx={ctx} />
    </DndContext>
  );
};

export default TraitTree;
