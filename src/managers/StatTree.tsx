import type { ReactNode } from 'react';
import { useStatEditorWorld } from '@/lib/useStatEditorWorld';
import type { LinkedStatRow } from '@/lib/statLinks';
import {
  applyStatDrop, buildStatTree, flattenStatTree, getStatDropProjection, removeChildrenOf, type FlatStatNode,
} from '@/lib/statGroupTree';
import type { Stat, StatGroup } from '@/types';
import { TREE_INDENT } from '@/components/EditorRow';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { statRowSpec, type StatRowActions } from './statRowSpec';
import { chipInput } from './chipInput';

/**
 * One owner's stat folder tree: a flat sortable list where horizontal drag sets nesting depth. The entity Stats
 * tab draws one entity's own; the caller says where a drop, a delete and a copy land. Groups are folders only:
 * they carry a name and a description and nothing that changes how a stat plays.
 */
const StatTree = ({
  stats, groups, linked, onDetach, selectedId, onSelect, onDrop, onRemoveStat, onRemoveGroup, onDuplicate, emptyHint,
}: StatRowActions & {
  stats: Stat[];
  /** The rows a link brings. A link's own row removes or detaches the link; a row below a linked group is fixed. */
  linked?: ReadonlyMap<string, LinkedStatRow>;
  groups: StatGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Writes the groups and stats a drag produced; the stats come back in tree order. */
  onDrop: (next: { groups: StatGroup[]; stats: Stat[] }) => void;
  /** Drawn in place of the tree while it holds nothing. */
  emptyHint: ReactNode;
}) => {
  const { placeholders } = useStatEditorWorld();

  const adapter: SortableTreeAdapter<FlatStatNode> = {
    visibleDeps: [groups, stats],
    rowDeps: [linked],
    rowInputs: (node) => [chipInput(placeholders, node.kind === 'group' ? node.group?.name : node.leaf?.name), node.leaf?.enabled],
    placeholders,
    getVisible: (collapsed) => removeChildrenOf(flattenStatTree(buildStatTree(groups, stats)), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getStatDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) =>
      onDrop(applyStatDrop(groups, stats, collapsed, activeId, overId, offsetLeft, TREE_INDENT)),
    rowSpec: (node, select) =>
      statRowSpec(node, select, linked?.get(node.id), placeholders, { onDetach, onRemoveStat, onRemoveGroup, onDuplicate }),
  };

  if (!stats.length && !groups.length) return <>{emptyHint}</>;
  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />;
};

export default StatTree;
