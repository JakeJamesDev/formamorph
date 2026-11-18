import { useGameData } from '@/contexts/GameDataContext';
import { GroupIcon } from '@/lib/elementIcons';
import { applyItemDrop, itemDropDepth, visibleItemRows, type FlatItemNode } from '@/lib/itemGroupTree';
import { SortableTree, type SortableTreeAdapter } from './SortableTree';
import { chipInput } from './chipInput';
import { TREE_INDENT } from '@/components/EditorRow';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import type { TreeCollapse } from '@/components/treeCollapse';

/** The Items tab's folder tree: a flat sortable list where horizontal drag sets nesting depth. Groups are
 *  editor-only folders; items are leaves. */
const ItemTree = ({ selectedId, onSelect, collapse, onDuplicate, onRemoveItem }: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The host's collapsed groups, which outlive the tree. */
  collapse: TreeCollapse;
  onDuplicate: (id: string) => void;
  /** An item's delete, which may ask first. */
  onRemoveItem: (id: string) => void;
}) => {
  const { items, itemGroups, setItems, setItemGroups, removeItemGroup, placeholders } = useGameData();

  const adapter: SortableTreeAdapter<FlatItemNode> = {
    visibleDeps: [itemGroups, items],
    rowDeps: [],
    rowInputs: (node) => [chipInput(placeholders, node.kind === 'group' ? node.group?.name : node.leaf?.name)],
    placeholders,
    getVisible: (collapsed) => visibleItemRows(itemGroups, items, collapsed),
    projectDepth: (visible, activeId, overId, offsetLeft) => itemDropDepth(visible, activeId, overId, offsetLeft, TREE_INDENT),
    onDrop: (activeId, overId, offsetLeft, collapsed) => {
      const next = applyItemDrop(itemGroups, items, collapsed, activeId, overId, offsetLeft, TREE_INDENT);
      if (next.groups !== itemGroups) setItemGroups(next.groups);
      if (next.items !== items) setItems(next.items);
    },
    rowSpec: (node) => {
      const isGroup = node.kind === 'group';
      return {
        lead: isGroup ? 'chevron' : 'none',
        collapseLabels: ['Expand group', 'Collapse group'],
        icon: isGroup ? <GroupIcon className="h-4 w-4 shrink-0" /> : undefined,
        label: <PlaceholderText text={isGroup ? node.group?.name ?? '' : node.leaf?.name ?? ''} placeholders={placeholders} />,
        labelClass: isGroup ? 'font-medium' : undefined,
        remove: () => { if (isGroup) removeItemGroup(node.id); else onRemoveItem(node.id); },
        duplicate: () => onDuplicate(node.id),
      };
    },
  };

  return <SortableTree adapter={adapter} selectedId={selectedId} onSelect={onSelect} collapse={collapse} revealSelected />;
};

export default ItemTree;
