// The shared drag-tree scaffold behind LocationTree, EntityTree and TraitTree: a flat sortable list where
// vertical drag reorders and horizontal drag changes nesting depth. Each tree supplies an adapter (visible
// rows, depth projection, drop commit, per-row presentation); everything else — drag state and the row
// chrome (grip / chevron / duplicate / delete) — lives here once, over the shared `EditorDndContext`.
//
// IMPORTANT: never clamp the drag's X. A full-axis bounding modifier (restrictToParentElement /
// restrictToFirstScrollableAncestor / restrictToVerticalAxis) clamps the horizontal delta and breaks
// depth-based nesting (see TraitTree history), which is why this passes `restrictYToScrollAncestor` rather
// than taking the shared layer's vertical-list default.
import { useState, type ReactNode } from 'react';
import { EditorRow, EditorRowList, type EditorRowAction } from '@/components/EditorRow';
import { X, Copy } from 'lucide-react';
import {
  pointerWithin, closestCenter,
  type CollisionDetection,
  type DragStartEvent, type DragMoveEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { restrictYToScrollAncestor } from '@/components/dnd/dragInvariants';

// Pointer-precise collisions, but never empty: at the very bottom the pointer sits past the last row, so
// `pointerWithin` alone returns nothing → dnd-kit drops the sort gap → the list shrinks → the pointer is
// "inside" again next frame → gap re-added. That per-frame height flip jitters the ScrollArea. Falling back
// to `closestCenter` when the pointer is outside every row keeps `over` pinned to the nearest row, so the gap
// (and the scroll height) stays stable.
const collisionWithFallback: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

import { useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const TREE_MODIFIERS = [restrictYToScrollAncestor];


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
  /** Secondary text before the actions, such as a holder count. */
  meta?: ReactNode;
  /** Tooltip for {@link TreeRowSpec.meta}, which is usually too terse to read on its own. */
  metaTitle?: string;
  /** Actions ahead of duplicate and delete, for anything only this tree offers. */
  actions?: EditorRowAction[];
  /** What the delete action is called, where "Delete" is not what the row's own X does. */
  removeTitle?: string;
  /** Absent on a fixed row, which offers no delete. */
  remove?: () => void;
  /** Absent on a fixed row, which offers no duplicate. */
  duplicate?: () => void;
  /** The row is derived from something else (an owner node read off an entity): it cannot be dragged, and
   *  rows may still be dropped beside or under it. */
  fixed?: boolean;
}

/** What a specific tree plugs into the shared scaffold. */
export interface SortableTreeAdapter<N extends { id: string; depth: number }> {
  /** Visible rows given the effective collapsed set (the dragged subtree's root is added while dragging). */
  getVisible: (collapsed: Set<string>) => N[];
  /** The dragged row's projected depth for the current pointer position, or null for no projection. */
  projectDepth: (visible: N[], activeId: string, overId: string, offsetLeft: number) => number | null;
  /** Commit a drop. */
  onDrop: (activeId: string, overId: string, offsetLeft: number, collapsed: Set<string>) => void;
  /** What `selectedId` and `onSelect` speak in, where a row is not itself the thing being selected — a
   *  placeholder draws a row under every holder that shares it, and all of them are that one placeholder.
   *  Defaults to the row's own id. */
  selectionId?: (node: N) => string;
  rowSpec: (node: N) => TreeRowSpec;
}

interface RowProps {
  id: string;
  /** What selecting this row reports — see `selectionId` on the adapter. */
  selectId: string;
  depth: number;
  spec: TreeRowSpec;
  selected: boolean;
  onSelect: (id: string) => void;
  isCollapsed: boolean;
  toggleCollapse: (id: string) => void;
}

/** One flat row with a depth-based left indent. */
function TreeRow({ id, selectId, depth, spec, selected, onSelect, isCollapsed, toggleCollapse }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: spec.fixed });
  // The dragged row's indent is shown via paddingLeft (projected depth), so pin its x-translate to 0 — it
  // slides vertically only while the pointer's horizontal delta drives depth. Sibling rows keep their full
  // transform (the reorder shift animation).
  const rowTransform = isDragging && transform ? { ...transform, x: 0 } : transform;
  const style = {
    // Translate (not Transform): Transform bakes in a scale that resizes the dragged row to the target slot.
    transform: CSS.Translate.toString(rowTransform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={style}
      depth={depth}
      gripProps={spec.fixed ? undefined : { ...attributes, ...listeners }}
      grip={!spec.fixed}
      gripTitle="Drag to reorder or nest"
      selected={selected}
      onSelect={() => onSelect(selectId)}
      lead={spec.lead === 'none' ? undefined : spec.lead}
      collapsed={isCollapsed}
      onToggleCollapse={() => toggleCollapse(id)}
      collapseLabels={spec.collapseLabels}
      icon={spec.icon}
      label={spec.label}
      labelClass={spec.labelClass}
      meta={spec.meta}
      metaTitle={spec.metaTitle}
      actions={[
        ...(spec.actions ?? []),
        ...(spec.duplicate ? [{ icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: spec.duplicate }] : []),
        ...(spec.remove ? [{ icon: <X className="h-4 w-4" />, title: spec.removeTitle ?? 'Delete', onClick: spec.remove }] : []),
      ]}
    />
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
    <EditorDndContext
      collisionDetection={collisionWithFallback}
      modifiers={TREE_MODIFIERS}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <StableSortableContext items={visible} strategy={verticalListSortingStrategy}>
        <EditorRowList>
        {visible.map((node) => (
          <TreeRow
            key={node.id}
            id={node.id}
            selectId={adapter.selectionId?.(node) ?? node.id}
            depth={node.id === activeId && projectedDepth !== null ? projectedDepth : node.depth}
            spec={adapter.rowSpec(node)}
            selected={selectedId === (adapter.selectionId?.(node) ?? node.id)}
            onSelect={onSelect}
            isCollapsed={collapsed.has(node.id)}
            toggleCollapse={toggleCollapse}
          />
        ))}
        </EditorRowList>
      </StableSortableContext>
    </EditorDndContext>
  );
}
