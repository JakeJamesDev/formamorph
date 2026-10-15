// The drag projection every flat-list tree shares (the dnd-kit "sortable tree" recipe): the horizontal pointer
// offset during a drag decides the drop depth, and the depth decides the parent. Each tree supplies which rows
// may take children. Pure, never mutates its inputs.

import { arrayMove } from '@dnd-kit/sortable';
import { clamp } from '@/lib/utils';

/** A drawn row: its id, the row it sits under (null at the top level), and its indentation depth. */
export interface ProjectedRow { id: string; parentId: string | null; depth: number }

/** The `canParent` rule of a tree where any row can hold another. */
export const anyRowCanParent = (): boolean => true;

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export function projectDrop<R extends ProjectedRow>(
  rows: readonly R[], activeId: string, overId: string,
  dragOffset: number, indentationWidth: number, canParent: (row: R) => boolean,
): { depth: number; parentId: string | null } {
  const overIndex = rows.findIndex((r) => r.id === overId);
  const activeIndex = rows.findIndex((r) => r.id === activeId);
  if (overIndex === -1 || activeIndex === -1) return { depth: 0, parentId: null };

  const activeRow = rows[activeIndex];
  const moved = arrayMove([...rows], activeIndex, overIndex);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];

  const projectedDepth = activeRow.depth + Math.round(dragOffset / indentationWidth);
  // A row descends one level past the row above only when that row can hold it.
  const maxDepth = prev ? prev.depth + (canParent(prev) ? 1 : 0) : 0;
  const minDepth = next ? next.depth : 0;
  const depth = clamp(projectedDepth, minDepth, maxDepth);

  const parentId = (() => {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id;
    return moved.slice(0, overIndex).reverse().find((r) => r.depth === depth)?.parentId ?? null;
  })();

  return { depth, parentId };
}

/** Drop every row that descends from any id in `ids` (collapsed rows, the dragged subtree). */
export function removeCollapsedRows<R extends { id: string; parentId: string | null }>(
  rows: readonly R[], ids: Iterable<string>,
): R[] {
  const exclude = new Set(ids);
  const out: R[] = [];
  for (const row of rows) {
    if (row.parentId !== null && exclude.has(row.parentId)) {
      exclude.add(row.id);
      continue;
    }
    out.push(row);
  }
  return out;
}

/** A drop every tree agrees on: the dragged row, where it lands, and the full row list after the move. */
export interface TreeDropPlan<R extends ProjectedRow> {
  active: R;
  /** The row the active row lands under, or null at the top level. */
  parent: R | null;
  parentId: string | null;
  /** Every row in drop order, the active row re-parented. Each tree reads its sibling order from here. */
  moved: R[];
}

/** What a tree supplies to the shared drop head. */
export interface TreeDropRules<R extends ProjectedRow> {
  canParent: (row: R) => boolean;
  /** True for a landing the tree can't take, such as one that nests a record inside itself. */
  refuses: (active: R, parent: R | null) => boolean;
}

/**
 * The shared head of a tree drop: hide collapsed rows and the dragged subtree, require both rows visible,
 * project the parent over the visible rows, apply the tree's refusal, then move the row in the full list.
 * Null for a hidden or unknown row, or a landing the tree refuses. Each tree commits the plan to its own data.
 */
export function planTreeDrop<R extends ProjectedRow>(
  rows: readonly R[], collapsedIds: Iterable<string>, activeId: string, overId: string,
  dragOffset: number, indentationWidth: number, { canParent, refuses }: TreeDropRules<R>,
): TreeDropPlan<R> | null {
  const visible = removeCollapsedRows(rows, [...collapsedIds, activeId]);
  if (!visible.some((r) => r.id === overId) || !visible.some((r) => r.id === activeId)) return null;

  const activeIndex = rows.findIndex((r) => r.id === activeId);
  const overIndex = rows.findIndex((r) => r.id === overId);
  const active = rows[activeIndex];

  const { parentId } = projectDrop(visible, activeId, overId, dragOffset, indentationWidth, canParent);
  const parent = parentId === null ? null : rows.find((r) => r.id === parentId) ?? null;
  if ((parentId !== null && !parent) || refuses(active, parent)) return null;

  const reParented = rows.map((r) => (r.id === activeId ? { ...r, parentId } : r));
  return { active, parent, parentId, moved: arrayMove(reParented, activeIndex, overIndex) };
}

/** The parent a raw `parentId`/`groupId` names, or null (top level) when it is absent or names nothing in
 *  `known`. A dangling reference must never make an item unreachable. */
export function knownParent(ref: string | null | undefined, known: Pick<ReadonlySet<string>, 'has'>): string | null {
  return ref != null && known.has(ref) ? ref : null;
}
