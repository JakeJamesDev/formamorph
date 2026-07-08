// The shared drag-tree scaffold behind LocationTree and TraitTree: a flat sortable list where vertical
// drag reorders and horizontal drag changes nesting depth. Each tree supplies an adapter (visible rows,
// depth projection, drop commit, per-row presentation); everything else — sensors, drag state, the row
// chrome (grip / chevron / duplicate / delete) — lives here once.
//
// IMPORTANT: no modifiers on the DndContext (e.g. restrictToParentElement) — a bounding-rect modifier
// clamps the horizontal delta and breaks depth-based nesting (see TraitTree history).
import { useState, type ReactNode } from 'react';
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

export const TREE_INDENT = 24; // px per nesting level — also the horizontal drag distance to change depth

/** Presentation + actions for one row, produced by the tree's adapter. */
export interface TreeRowSpec {
  /** 'chevron' = collapsible; 'spacer' = reserve the chevron slot for alignment; 'none' = no slot. */
  lead: 'chevron' | 'spacer' | 'none';
  /** aria-labels for the chevron button as [expand, collapse]. */
  collapseLabels?: [string, string];
  /** Optional icon between the grip and the label (e.g. a folder for groups). */
  icon?: ReactNode;
  label: ReactNode;
  /** Extra classes on the label span (e.g. 'font-medium' for group headers). */
  labelClass?: string;
  remove: () => void;
  duplicate: () => void;
}

/** What a specific tree plugs into the shared scaffold. */
export interface SortableTreeAdapter<N extends { id: string; depth: number }> {
  /** Visible rows given the effective collapsed set (the dragged subtree's root is added while dragging). */
  getVisible: (collapsed: Set<string>) => N[];
  /** The dragged row's projected depth for the current pointer position, or null for no projection. */
  projectDepth: (visible: N[], activeId: string, overId: string, offsetLeft: number) => number | null;
  /** Commit a drop. */
  onDrop: (activeId: string, overId: string, offsetLeft: number, collapsed: Set<string>) => void;
  rowSpec: (node: N) => TreeRowSpec;
}

interface RowProps {
  id: string;
  depth: number;
  spec: TreeRowSpec;
  selected: boolean;
  onSelect: (id: string) => void;
  isCollapsed: boolean;
  toggleCollapse: (id: string) => void;
}

/** One flat row with a depth-based left indent. */
function TreeRow({ id, depth, spec, selected, onSelect, isCollapsed, toggleCollapse }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // The dragged row's indent is shown via paddingLeft (projected depth), so pin its x-translate to 0 — it
  // slides vertically only while the pointer's horizontal delta drives depth. Sibling rows keep their full
  // transform (the reorder shift animation).
  const rowTransform = isDragging && transform ? { ...transform, x: 0 } : transform;
  const style = {
    transform: CSS.Transform.toString(rowTransform),
    transition,
    paddingLeft: depth * TREE_INDENT,
    opacity: isDragging ? 0.5 : 1,
  };
  const rowClass = `p-2 cursor-pointer rounded-md transition-colors flex items-center gap-1
    ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`;
  const [expandLabel, collapseLabel] = spec.collapseLabels ?? ['Expand', 'Collapse'];

  return (
    <div ref={setNodeRef} style={style} onClick={(e) => { e.stopPropagation(); onSelect(id); }} className={rowClass}>
      {spec.lead === 'chevron' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleCollapse(id); }}
          className="shrink-0"
          aria-label={isCollapsed ? expandLabel : collapseLabel}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      ) : spec.lead === 'spacer' ? (
        <span className="w-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`cursor-grab touch-none px-1 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
        title="Drag to reorder or nest"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {spec.icon}
      <span className={`flex-grow ${spec.labelClass ?? ''}`}>{spec.label}</span>
      <Button
        variant="ghost"
        size="icon"
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        onClick={(e) => { e.stopPropagation(); spec.duplicate(); }}
        title="Duplicate"
      >
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        onClick={(e) => { e.stopPropagation(); spec.remove(); }}
        title="Delete"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SortableTree<N extends { id: string; depth: number }>({ adapter, selectedId, onSelect }: {
  adapter: SortableTreeAdapter<N>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Visible rows: the tree minus collapsed nodes' children and (while dragging) the dragged subtree.
  const visible = adapter.getVisible(activeId ? new Set([...collapsed, activeId]) : collapsed);
  const projectedDepth = activeId && overId
    ? adapter.projectDepth(visible, activeId, overId, offsetLeft)
    : null;

  const reset = () => { setActiveId(null); setOverId(null); setOffsetLeft(0); };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverId(String(active.id));
  };
  const handleDragMove = ({ delta }: DragMoveEvent) => setOffsetLeft(delta.x);
  const handleDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over) adapter.onDrop(String(active.id), String(over.id), offsetLeft, collapsed);
    reset();
  };

  const toggleCollapse = (id: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
            id={node.id}
            depth={node.id === activeId && projectedDepth !== null ? projectedDepth : node.depth}
            spec={adapter.rowSpec(node)}
            selected={selectedId === node.id}
            onSelect={onSelect}
            isCollapsed={collapsed.has(node.id)}
            toggleCollapse={toggleCollapse}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
