import { useMemo, type ReactNode } from 'react';
import { FilePlus, FolderPlus, LayoutTemplate } from 'lucide-react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { ListMenuRow } from '@/components/ListToolbar';
import { useGameData } from '@/contexts/GameDataContext';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { useEditorMode } from '@/lib/editorMode';
import { blueprintsPlaceholderGroup } from '@/lib/placeholderBlueprints';
import { placeholderOwnerRef, type PlaceholderOwnerRef } from '@/lib/placeholderHomes';
import { newPlaceholder } from '@/lib/placeholders';
import { ownerIdOfNode, placeholderTreeNodes } from '@/lib/placeholderScopes';
import { randomUUID } from '@/lib/uuid';
import PlaceholderList from './PlaceholderList';
import { usePlaceholderDetail } from './PlaceholderDetail';
import { placeholderSearchRows } from './placeholderSearchRows';
import { usePlaceholderRowActions } from './usePlaceholderRowActions';

/**
 * The World Editor's Placeholders tab as a List Editor adapter: the world's placeholder tree, a flat search over
 * each placeholder's own row, and the detail router's pane. `ownerId` is whose placeholder is open, for the
 * palette; `dialog` is the delete confirmation the search rows open, which the host renders.
 */
export function useWorldPlaceholdersAdapter({ selectedId, onSelect, onOpenOwner }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenOwner: (owner: PlaceholderOwnerRef) => void;
}): { adapter: ListEditorAdapter; ownerId?: string; dialog: ReactNode } {
  const { placementLetters, placeholderOwners, placeholderGroups, addPlaceholder, addPlaceholderGroup } = useGameData();
  const { placeholders, lists } = usePlaceholderStore();
  const { advanced } = useEditorMode();
  const { detail, footer, ownerId } = usePlaceholderDetail({ selectedId, onSelect, onOpenOwner });
  const { rowRules, dialog } = usePlaceholderRowActions({ selectedId, onSelect });

  const nodes = useMemo(() => (lists ? placeholderTreeNodes(lists) : []), [lists]);
  const nodeIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  const handleAddPlaceholder = (typed: string) => {
    const p = newPlaceholder(typed || 'New Placeholder');
    addPlaceholder(p);
    onSelect(p.id);
  };
  // New placeholder folders append at the root; the author drags shared placeholders into them.
  const rootCount = () => placeholderGroups.filter((g) => g.parentId === null).length;
  const handleAddGroup = (typed: string) => {
    const id = randomUUID();
    addPlaceholderGroup({ id, name: typed || 'New Group', parentId: null, order: rootCount() });
    onSelect(id);
  };
  // The world holds at most one placeholder Blueprints group, so its add hides once it exists.
  const handleAddBlueprints = () => {
    const id = randomUUID();
    addPlaceholderGroup({ id, name: 'Blueprints', parentId: null, order: rootCount(), system: 'blueprints' });
    onSelect(id);
  };

  const adapter: ListEditorAdapter = {
    tree: <PlaceholderList selectedId={selectedId} onSelect={onSelect} />,
    rows: () => (lists ? placeholderSearchRows(nodes, lists, rowRules, { withOwner: true }) : []),
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    noun: 'placeholders',
    detail: (id) => id && detail,
    footer: () => footer,
    add: advanced ? {
      label: 'Add to Placeholders',
      menuClassName: 'w-56',
      menu: (
        <>
          <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label="Add Group" onAdd={handleAddGroup} />
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label="Add Placeholder" onAdd={handleAddPlaceholder} />
          {!blueprintsPlaceholderGroup(placeholderGroups) && (
            <ListMenuRow icon={<LayoutTemplate className="h-4 w-4" />} label="Add Blueprints Group" onAdd={handleAddBlueprints} />
          )}
        </>
      ),
    } : { label: 'Add to Placeholders', onAdd: handleAddPlaceholder },
    placeholder: 'Search or add new placeholders',
    // What the detail router resolves: a drawn row or folder, an owner, or a bare placeholder id.
    holds: (id) => {
      if (nodeIds.has(id) || placeholders.some((p) => p.id === id)) return true;
      const owner = ownerIdOfNode(id);
      return !!owner && !!lists && !!placeholderOwnerRef(lists, owner);
    },
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
  return { adapter, ownerId, dialog };
}
