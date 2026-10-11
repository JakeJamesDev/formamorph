import type { ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Link2 } from 'lucide-react';
import { BlueprintIcon, GroupIcon } from '@/lib/elementIcons';
import {
  applyStatDrop, buildStatTree, flattenStatTree, getStatDropProjection, removeChildrenOf, type FlatStatNode,
} from '@/lib/statGroupTree';
import type { Stat, StatGroup } from '@/types';
import { TREE_INDENT } from '@/components/EditorRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { chipInput } from './chipInput';

/**
 * The Stats tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. One tree draws
 * the world's stats and one entity's own; the caller says where a drop, a delete and a copy land. Groups are
 * folders only: they carry a name and a description and nothing that changes how a stat plays.
 */
const StatTree = ({ stats, groups, linkIds, selectedId, onSelect, onDrop, onRemoveStat, onRemoveGroup, onDuplicate, emptyHint }: {
  stats: Stat[];
  /** The rows among `stats` that are links: they draw a link icon and remove the link, and never duplicate. */
  linkIds?: ReadonlySet<string>;
  groups: StatGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Writes the groups and stats a drag produced; the stats come back in tree order. */
  onDrop: (next: { groups: StatGroup[]; stats: Stat[] }) => void;
  onRemoveStat: (id: string) => void;
  onRemoveGroup: (id: string) => void;
  onDuplicate: (id: string) => void;
  /** Drawn in place of the tree while it holds nothing. */
  emptyHint: ReactNode;
}) => {
  const { placeholders } = useGameData();

  const adapter: SortableTreeAdapter<FlatStatNode> = {
    visibleDeps: [groups, stats],
    rowDeps: [],
    rowInputs: (node) => [chipInput(placeholders, node.kind === 'group' ? node.group?.name : node.leaf?.name)],
    placeholders,
    getVisible: (collapsed) => removeChildrenOf(flattenStatTree(buildStatTree(groups, stats)), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getStatDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) =>
      onDrop(applyStatDrop(groups, stats, collapsed, activeId, overId, offsetLeft, TREE_INDENT)),
    rowSpec: (node) => {
      const isGroup = node.kind === 'group';
      if (node.group?.system === 'blueprints') {
        return {
          lead: 'chevron',
          collapseLabels: ['Expand group', 'Collapse group'],
          icon: <BlueprintIcon className="h-4 w-4 shrink-0" aria-hidden />,
          label: <PlaceholderText text={node.group.name} placeholders={placeholders} />,
          labelClass: 'font-medium',
          removeTitle: 'Remove Blueprints',
          remove: () => onRemoveGroup(node.id),
        };
      }
      if (linkIds?.has(node.id)) {
        return {
          lead: 'none',
          icon: <Link2 className="h-4 w-4 shrink-0" aria-label="Link" />,
          label: <PlaceholderText text={node.leaf?.name ?? ''} placeholders={placeholders} />,
          removeTitle: 'Remove Link',
          remove: () => onRemoveStat(node.id),
        };
      }
      return {
        // Only groups collapse; stats get no leading slot (matching the flat list layout).
        lead: isGroup ? 'chevron' : 'none',
        collapseLabels: ['Expand group', 'Collapse group'],
        icon: isGroup ? <GroupIcon className="h-4 w-4 shrink-0" /> : undefined,
        label: <PlaceholderText text={isGroup ? node.group?.name ?? '' : node.leaf?.name ?? ''} placeholders={placeholders} />,
        labelClass: isGroup ? 'font-medium' : undefined,
        remove: () => (isGroup ? onRemoveGroup(node.id) : onRemoveStat(node.id)),
        duplicate: () => onDuplicate(node.id),
      };
    },
  };

  if (!stats.length && !groups.length) return <>{emptyHint}</>;
  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} />;
};

export default StatTree;
