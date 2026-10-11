import type { ReactNode } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Link2, Unlink } from 'lucide-react';
import { BlueprintIcon, GroupIcon } from '@/lib/elementIcons';
import type { LinkedStatRow } from '@/lib/statLinks';
import { labelPlaceholders } from '@/lib/placementLetters';
import { Tip } from '@/components/ui/tooltip';
import {
  applyStatDrop, buildStatTree, flattenStatTree, getStatDropProjection, removeChildrenOf, type FlatStatNode,
} from '@/lib/statGroupTree';
import type { Stat, StatGroup } from '@/types';
import { TREE_INDENT } from '@/components/EditorRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { SortableTree, type SortableTreeAdapter, type TreeRowSpec } from './SortableTree';
import { chipInput } from './chipInput';

/**
 * The Stats tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. One tree draws
 * the world's stats and one entity's own; the caller says where a drop, a delete and a copy land. Groups are
 * folders only: they carry a name and a description and nothing that changes how a stat plays.
 */
const StatTree = ({ stats, groups, linked, onDetach, selectedId, onSelect, onDrop, onRemoveStat, onRemoveGroup, onDuplicate, emptyHint }: {
  stats: Stat[];
  /** The rows a link brings. A link's own row removes or detaches the link; a row below a linked group is fixed. */
  linked?: ReadonlyMap<string, LinkedStatRow>;
  /** Turns a link into the entity's own stats. */
  onDetach?: (linkId: string) => void;
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
    rowDeps: [linked],
    rowInputs: (node) => [chipInput(placeholders, node.kind === 'group' ? node.group?.name : node.leaf?.name)],
    placeholders,
    getVisible: (collapsed) => removeChildrenOf(flattenStatTree(buildStatTree(groups, stats)), collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) =>
      getStatDropProjection(visible, activeId, overId, offsetLeft, TREE_INDENT)?.depth ?? null,
    onDrop: (activeId, overId, offsetLeft, collapsed) =>
      onDrop(applyStatDrop(groups, stats, collapsed, activeId, overId, offsetLeft, TREE_INDENT)),
    rowSpec: (node, select) => {
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
      const row = linked?.get(node.id);
      if (row) {
        // A group link's row marks any override on the stats it brings.
        const overrides = row.kind === 'group' ? row.link.overrides : row.link.overrides?.[row.originalId];
        const name = (isGroup ? node.group?.name : node.leaf?.name) ?? '';
        const shared = {
          lead: isGroup ? 'chevron' : 'none',
          collapseLabels: ['Expand group', 'Collapse group'],
          label: <PlaceholderText text={name} placeholders={placeholders} />,
          labelClass: isGroup ? 'font-medium' : row.unbound ? 'text-muted-foreground' : undefined,
          overridden: overrides && Object.keys(overrides).length ? 'Modified for this link' : undefined,
        } satisfies Partial<TreeRowSpec>;
        // A linked group's subtree is the original's, so its rows are read here and edited there.
        if (!row.root) {
          const linkName = labelPlaceholders(row.link.originalName, placeholders);
          return {
            ...shared,
            icon: (
              <Tip tip={`Part of the linked ${linkName}`} labelsChild={false}>
                <span className="shrink-0 px-0.5" aria-label="Linked"><Link2 className="h-4 w-4 opacity-50" /></span>
              </Tip>
            ),
            fixed: true,
            removeTitle: 'Remove',
            removeBlocked: `Detach ${linkName} to remove this ${isGroup ? 'group' : 'stat'}`,
          };
        }
        const label = labelPlaceholders(name, placeholders);
        return {
          ...shared,
          icon: (
            <Tip tip={`Linked, opens ${label}`} labelsChild={false}>
              <button
                type="button"
                aria-label={`Open ${label}`}
                onClick={(e) => { e.stopPropagation(); select(node.id); }}
                className="shrink-0 px-0.5"
              >
                <Link2 className="h-4 w-4" />
              </button>
            </Tip>
          ),
          actions: onDetach && !row.unbound
            ? [{ icon: <Unlink className="h-4 w-4" />, title: 'Detach', onClick: () => onDetach(row.link.id) }] : undefined,
          removeTitle: 'Remove Link',
          remove: () => onRemoveStat(row.link.id),
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
