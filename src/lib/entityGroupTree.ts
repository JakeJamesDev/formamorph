// Pure helpers for the entity folder tree (groups + entities, nestable via parentId/groupId). The editor
// builds/walks the tree from the two flat arrays kept on the world. Groups are editor-only organization and
// are NEVER sent to the AI — there is deliberately no build*Context here (unlike traitTree), because entities
// feed the AI exactly as if ungrouped. Mirrors traitTree's drag/duplicate machinery otherwise.

import type { Entity, EntityGroup } from '@/types';

export type EntityTreeNode =
  | { kind: 'group'; id: string; group: EntityGroup; children: EntityTreeNode[] }
  | { kind: 'entity'; id: string; entity: Entity };

/** Direct children (subgroups + entities) of `parentId`, ordered by `order` (falling back to array index). */
function childrenOf(groups: EntityGroup[], entities: Entity[], parentId: string | null): EntityTreeNode[] {
  const entries: { node: EntityTreeNode; sort: number }[] = [];
  groups.forEach((g, i) => {
    if ((g.parentId ?? null) === parentId) {
      entries.push({ node: { kind: 'group', id: g.id, group: g, children: [] }, sort: g.order ?? i });
    }
  });
  entities.forEach((e, i) => {
    if ((e.groupId ?? null) === parentId) {
      entries.push({ node: { kind: 'entity', id: e.id, entity: e }, sort: e.order ?? i });
    }
  });
  return entries.sort((a, b) => a.sort - b.sort).map((e) => e.node);
}

/** Build the full ordered tree of top-level nodes, each group carrying its recursive children. */
export function buildEntityTree(groups: EntityGroup[], entities: Entity[]): EntityTreeNode[] {
  const build = (parentId: string | null): EntityTreeNode[] =>
    childrenOf(groups, entities, parentId).map((node) =>
      node.kind === 'group' ? { ...node, children: build(node.id) } : node,
    );
  return build(null);
}

/** True if `candidateId` is `ancestorId` itself or nested anywhere beneath it — guards illegal moves. */
export function isDescendantGroup(groups: EntityGroup[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(groups.map((g) => [g.id, g]));
  let cur: string | null | undefined = candidateId;
  while (cur) {
    if (cur === ancestorId) return true;
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

/**
 * Deep-duplicate an entity or a whole group subtree, inserting the copy immediately after the original
 * within the same parent/group. Groups bring all nested subgroups + entities, each with a fresh id and
 * remapped parent links; only the top copied item's name gets a " (Copy)" suffix. Sibling `order`s of the
 * affected parent are renormalized so the copy reliably follows the original. Never mutates inputs; a missing
 * id is a no-op (returns the same arrays + the id unchanged).
 */
export function duplicateEntityNode(
  groups: EntityGroup[], entities: Entity[], id: string,
): { groups: EntityGroup[]; entities: Entity[]; newId: string } {
  const isGroup = groups.some((g) => g.id === id);
  const isEntity = entities.some((e) => e.id === id);
  if (!isGroup && !isEntity) return { groups, entities, newId: id };

  const subtreeGroupIds = new Set<string>();
  if (isGroup) {
    const collect = (gid: string) => {
      subtreeGroupIds.add(gid);
      groups.filter((g) => (g.parentId ?? null) === gid).forEach((c) => collect(c.id));
    };
    collect(id);
  }
  const subtreeEntityIds = isGroup
    ? entities.filter((e) => e.groupId && subtreeGroupIds.has(e.groupId)).map((e) => e.id)
    : [id];

  const idMap = new Map<string, string>();
  subtreeGroupIds.forEach((gid) => idMap.set(gid, crypto.randomUUID()));
  subtreeEntityIds.forEach((eid) => idMap.set(eid, crypto.randomUUID()));
  const newId = idMap.get(id)!;
  const rootParent = isGroup
    ? groups.find((g) => g.id === id)!.parentId ?? null
    : entities.find((e) => e.id === id)!.groupId ?? null;

  const clonedGroups: EntityGroup[] = [...subtreeGroupIds].map((gid) => {
    const copy = structuredClone(groups.find((g) => g.id === gid)!);
    copy.id = idMap.get(gid)!;
    copy.parentId = gid === id ? rootParent : idMap.get(copy.parentId!)!; // root keeps parent; rest remap
    return copy;
  });
  const clonedEntities: Entity[] = subtreeEntityIds.map((eid) => {
    const copy = structuredClone(entities.find((e) => e.id === eid)!);
    copy.id = idMap.get(eid)!;
    copy.groupId = isGroup ? idMap.get(copy.groupId!)! : rootParent;
    return copy;
  });

  const root = isGroup
    ? clonedGroups.find((g) => g.id === newId)!
    : clonedEntities.find((e) => e.id === newId)!;
  root.name = `${root.name} (Copy)`;

  const g2 = groups.map((g) => ({ ...g })).concat(clonedGroups);
  const e2 = entities.map((e) => ({ ...e })).concat(clonedEntities);

  // Place the copy right after the original among its siblings, then renormalize that parent's order.
  const seq = childrenOf(groups, entities, rootParent).map((n) => n.id);
  seq.splice(seq.indexOf(id) + 1, 0, newId);
  seq.forEach((sid, i) => {
    const g = g2.find((x) => x.id === sid);
    if (g) { g.order = i; return; }
    const e = e2.find((x) => x.id === sid);
    if (e) e.order = i;
  });

  return { groups: g2, entities: e2, newId };
}

// ---- Sortable-tree drag projection (editor Entities tab) --------------------------------------------
// Ports the dnd-kit "sortable tree" recipe: a single flat list where the horizontal pointer offset during a
// drag decides the drop depth (and thus the parent). Entities are leaves, so a row may only nest under a group.

export interface FlatEntityNode {
  id: string;
  kind: 'group' | 'entity';
  parentId: string | null;
  depth: number;
  group?: EntityGroup;
  entity?: Entity;
}

/** Depth-first flatten of the tree, tagging each node with its parent and indentation depth. */
export function flattenEntityTree(tree: EntityTreeNode[]): FlatEntityNode[] {
  const out: FlatEntityNode[] = [];
  const walk = (nodes: EntityTreeNode[], parentId: string | null, depth: number) => {
    for (const node of nodes) {
      if (node.kind === 'group') {
        out.push({ id: node.id, kind: 'group', parentId, depth, group: node.group });
        walk(node.children, node.id, depth + 1);
      } else {
        out.push({ id: node.id, kind: 'entity', parentId, depth, entity: node.entity });
      }
    }
  };
  walk(tree, null, 0);
  return out;
}

/** Drop every node that descends from any id in `ids` (collapsed groups, the dragged subtree). */
export function removeChildrenOf(items: FlatEntityNode[], ids: Iterable<string>): FlatEntityNode[] {
  const exclude = new Set(ids);
  const out: FlatEntityNode[] = [];
  for (const item of items) {
    if (item.parentId !== null && exclude.has(item.parentId)) {
      if (item.kind === 'group') exclude.add(item.id);
      continue;
    }
    out.push(item);
  }
  return out;
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Projected drop `{depth, parentId}` for the active row, given the pointer's horizontal drag offset. */
export function getEntityDropProjection(
  items: FlatEntityNode[], activeId: string, overId: string,
  dragOffset: number, indentationWidth: number,
): { depth: number; parentId: string | null } {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  if (overIndex === -1 || activeIndex === -1) return { depth: 0, parentId: null };

  const activeItem = items[activeIndex];
  const newItems = arrayMove(items, activeIndex, overIndex);
  const prev = newItems[overIndex - 1];
  const next = newItems[overIndex + 1];

  const dragDepth = Math.round(dragOffset / indentationWidth);
  const projectedDepth = activeItem.depth + dragDepth;
  // An entity can't be a parent, so you can only descend a level past a group.
  const maxDepth = prev ? prev.depth + (prev.kind === 'group' ? 1 : 0) : 0;
  const minDepth = next ? next.depth : 0;
  const depth = clamp(projectedDepth, minDepth, maxDepth);

  const parentId = (() => {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id; // prev is a group (maxDepth cap guarantees it)
    return newItems.slice(0, overIndex).reverse().find((i) => i.depth === depth)?.parentId ?? null;
  })();

  return { depth, parentId };
}

/**
 * Resolve a drag into new groups/entities arrays. Projects the drop parent from `dragOffset` (using the
 * visible list, minus the dragged subtree), then re-parents and reindexes order across the full tree.
 * Illegal moves (a group into itself or a descendant) and unfound ids are no-ops. Never mutates inputs.
 */
export function applyEntityDrop(
  groups: EntityGroup[], entities: Entity[], collapsedIds: Iterable<string>,
  activeId: string, overId: string, dragOffset: number, indentationWidth: number,
): { groups: EntityGroup[]; entities: Entity[] } {
  const full = flattenEntityTree(buildEntityTree(groups, entities));
  const visible = removeChildrenOf(full, [...collapsedIds, activeId]);
  if (!visible.some((i) => i.id === overId) || !visible.some((i) => i.id === activeId)) {
    return { groups, entities };
  }
  const { parentId } = getEntityDropProjection(visible, activeId, overId, dragOffset, indentationWidth);

  const isGroup = groups.some((g) => g.id === activeId);
  if (isGroup && parentId !== null && isDescendantGroup(groups, activeId, parentId)) {
    return { groups, entities };
  }

  const activeIndex = full.findIndex((i) => i.id === activeId);
  const overIndex = full.findIndex((i) => i.id === overId);
  if (activeIndex === -1 || overIndex === -1) return { groups, entities };

  const reParented = full.map((i) => (i.id === activeId ? { ...i, parentId } : i));
  const sorted = arrayMove(reParented, activeIndex, overIndex);

  const g2 = groups.map((g) => ({ ...g }));
  const e2 = entities.map((e) => ({ ...e }));
  const byGroup = new Map(g2.map((g) => [g.id, g]));
  const byEntity = new Map(e2.map((e) => [e.id, e]));
  const orderByParent = new Map<string, number>();
  for (const item of sorted) {
    const key = item.parentId ?? '\0root';
    const order = orderByParent.get(key) ?? 0;
    orderByParent.set(key, order + 1);
    if (item.kind === 'group') {
      const g = byGroup.get(item.id);
      if (g) { g.parentId = item.parentId; g.order = order; }
    } else {
      const e = byEntity.get(item.id);
      if (e) { e.groupId = item.parentId; e.order = order; }
    }
  }
  return { groups: g2, entities: e2 };
}
