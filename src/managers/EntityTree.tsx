import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import {
  buildTree, flattenTree, removeCollapsedChildren, getDropProjection, applyDrop,
  removePromotingChildren, type FlatTreeNode,
} from '@/lib/parentIdTree';
import { SortableTree, TREE_INDENT, type SortableTreeAdapter } from './SortableTree';
import { EmptyListHint } from '@/components/EmptyListHint';
import type { Entity } from '@/types';

/** The Entities tab's grouping tree: a flat sortable list where horizontal drag sets nesting depth. Mirrors
 *  LocationTree; the nesting is reflected to the AI as indentation (see buildEntityContext). */
const EntityTree = ({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) => {
  const { entities, setEntities } = useGameData();

  // Ids that parent at least one entity — drives the chevron (from the full list, so a collapsed node
  // still shows its expand chevron).
  const parentIds = useMemo(
    () => new Set(entities.map((e) => e.parentId ?? null).filter((p): p is string => p !== null)),
    [entities],
  );

  const adapter: SortableTreeAdapter<FlatTreeNode<Entity>> = {
    getVisible: (collapsed) => removeCollapsedChildren(flattenTree(buildTree(entities)), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      const next = applyDrop(entities, collapsed, activeId, overId, offsetLeft, TREE_INDENT);
      if (next !== entities) setEntities(next);
    },
    rowSpec: (node) => ({
      // Any entity can hold children, so non-parents reserve the chevron slot for alignment.
      lead: parentIds.has(node.id) ? 'chevron' : 'spacer',
      collapseLabels: ['Expand nested entities', 'Collapse nested entities'],
      label: node.item.name,
      remove: () => setEntities(removePromotingChildren(entities, node.id)),
      duplicate: () => {
        const index = entities.findIndex((e) => e.id === node.id);
        if (index === -1) return;
        const copy = { ...structuredClone(entities[index]), id: crypto.randomUUID() };
        copy.name = `${copy.name} (Copy)`;
        setEntities([...entities.slice(0, index + 1), copy, ...entities.slice(index + 1)]);
        onSelect(copy.id);
      },
    }),
  };

  if (!entities.length) {
    return <EmptyListHint noun="entities" />;
  }

  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />;
};

export default EntityTree;
