import { useMemo, type ReactNode } from 'react';
import { Copy, FilePlus, FolderPlus, LayoutTemplate, Link2, X } from 'lucide-react';
import type { EditorRowAction } from '@/components/EditorRow';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import { ListMenuRow } from '@/components/ListToolbar';
import { useGameData } from '@/contexts/GameDataContext';
import { usePlaceholderStore } from '@/contexts/PlaceholderStoreContext';
import { useEditorMode } from '@/lib/editorMode';
import { blueprintsPlaceholderGroup, copyName } from '@/lib/placeholderBlueprints';
import {
  allPlaceholders, placeholderOwnerRef, type PlaceholderHomesWorld, type PlaceholderOwnerRef,
} from '@/lib/placeholderHomes';
import { newPlaceholder, PLACEHOLDER_PATH_SEPARATOR, SHARED_PATH_SEP } from '@/lib/placeholders';
import { ownerIdOfNode, placeholderTreeNodes, type PlaceholderRowNode } from '@/lib/placeholderScopes';
import { randomUUID } from '@/lib/uuid';
import type { Placeholder } from '@/types';
import PlaceholderList from './PlaceholderList';
import { usePlaceholderDetail } from './PlaceholderDetail';
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
  const { askRemove, duplicate, copyOf, removeBlocked, dialog } = usePlaceholderRowActions({ selectedId, onSelect });

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

  // Each placeholder once, at its own row: a shared reference and the rows it repeats beneath it stay out.
  // A world row reads its chain bare, an owned row `Owner › Chain`, and a copy as its tree row does.
  const rows = (): ListEditorRow[] => {
    if (!lists) return [];
    const byId = new Map(allPlaceholders(lists).map((p) => [p.id, p]));
    const repeated = new Set<string>();
    const out: ListEditorRow[] = [];
    for (const node of nodes) {
      if (node.kind !== 'placeholder') continue;
      if (node.shared || (node.parentId && repeated.has(node.parentId))) {
        repeated.add(node.id);
        continue;
      }
      const copy = copyOf(node);
      out.push({
        id: node.id,
        name: rowLabel(node, byId, lists),
        icon: copy ? <Link2 className="h-4 w-4 shrink-0" aria-label="Copy" /> : undefined,
        actions: rowActions(node, copy),
      });
    }
    return out;
  };
  const rowActions = (node: PlaceholderRowNode, copy: ReturnType<typeof copyOf>): EditorRowAction[] => {
    const blocked = removeBlocked(copy);
    return [
      // One copy per blueprint per owner.
      ...(node.placeholder.blueprintId ? [] : [{ icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicate(node) }]),
      blocked
        ? { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => {}, disabledReason: blocked }
        : { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => askRemove(node) },
    ];
  };

  const adapter: ListEditorAdapter = {
    tree: <PlaceholderList selectedId={selectedId} onSelect={onSelect} />,
    rows,
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

/** A search row's label: the row's chain of names, under its owner when it has one. */
function rowLabel(node: PlaceholderRowNode, byId: ReadonlyMap<string, Placeholder>, lists: PlaceholderHomesWorld): string {
  const chain = node.id.split(SHARED_PATH_SEP).map((id) => byId.get(id));
  const names = chain.map((p) => p?.name ?? '');
  const owner = node.home.kind === 'world' ? undefined : placeholderOwnerRef(lists, node.home.ownerId);
  if (!owner) return names.join(PLACEHOLDER_PATH_SEPARATOR);
  // A copy reads as its owner's, named after its blueprint live, as its tree row does.
  const root = chain[0];
  if (root?.blueprintId) {
    names[0] = copyName(owner.name, byId.get(root.blueprintId)?.name ?? root.name);
    return names.join(PLACEHOLDER_PATH_SEPARATOR);
  }
  return [owner.name, ...names].join(PLACEHOLDER_PATH_SEPARATOR);
}
