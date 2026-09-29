import type { ReactNode } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { Copy, FilePlus, FolderPlus, X } from 'lucide-react';
import { ContentLinkIcon } from '@/components/ContentLinkStatus';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import { ListMenuRow } from '@/components/ListToolbar';
import { useGameData } from '@/contexts/GameDataContext';
import { entityRootCount, newEntity } from '@/lib/blankWorld';
import { useEditorMode } from '@/lib/editorMode';
import { duplicateEntityNode } from '@/lib/entityGroupTree';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint } from '@/types';
import type { EntityPanelTab } from '@/views/entityPanelTabs';
import { focusFieldForItem } from '@/views/findFocus';
import EntityGroupManager from './EntityGroupManager';
import EntityManager from './EntityManager';
import EntityTree from './EntityTree';
import { useRemoveEntity } from './useRemoveEntity';

/**
 * The World Editor's Entities tab as a List Editor adapter: the folder tree, a flat sortable search over
 * entities, and the group or entity panel. The entity panel's tab and its trait and placeholder rows are held
 * by the host, so they survive a switch between entities. `dialog` is the delete confirmation; the host renders it.
 */
export function useWorldEntitiesAdapter({
  selectedId, onSelect, tab, onTabChange, traitId, onTraitIdChange, placeholderId, onPlaceholderIdChange,
  onOpenWorldPlaceholder, focusField,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tab: EntityPanelTab;
  onTabChange: (tab: EntityPanelTab) => void;
  traitId: string | null;
  onTraitIdChange: (id: string | null) => void;
  placeholderId: string | null;
  onPlaceholderIdChange: (id: string | null) => void;
  onOpenWorldPlaceholder: (id: string) => void;
  focusField: FocusFieldHint | null;
}): { adapter: ListEditorAdapter; dialog: ReactNode } {
  const {
    entities, entityGroups, placeholders, placementLetters, placeholderOwners, addEntity, addEntityGroup, setEntities,
  } = useGameData();
  const { advanced } = useEditorMode();
  const { ask: askRemoveEntity, dialog } = useRemoveEntity();

  // New entities and groups append at the root; the author drags them into folders.
  const rootCount = () => entityRootCount({ entities, entityGroups });
  const handleAddEntity = (typed: string) => {
    const id = randomUUID();
    addEntity(newEntity(id, rootCount(), typed || undefined));
    onSelect(id);
  };
  const handleAddGroup = (typed: string) => {
    const id = randomUUID();
    addEntityGroup({ id, name: typed || 'New Group', parentId: null, order: rootCount() });
    onSelect(id);
  };
  // A copy needs fresh ids for what it owns, which the entity tree's duplicate gives it.
  const duplicate = (id: string) => {
    const res = duplicateEntityNode(entityGroups, entities, id);
    setEntities(res.entities);
    onSelect(res.newId);
  };

  const rows = (): ListEditorRow[] => entities.map((e) => ({
    id: e.id,
    name: e.name,
    icon: <ContentLinkIcon link={e.link} />,
    sortable: true,
    actions: [
      { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => duplicate(e.id) },
      { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => { askRemoveEntity(e.id); onSelect(null); } },
    ],
  }));

  // Moves an entity by its place in the world's array, not its place in the tree (drift log #3).
  const onReorder = (activeId: string, overId: string) => {
    const oldIndex = entities.findIndex((e) => e.id === activeId);
    const newIndex = entities.findIndex((e) => e.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    setEntities(arrayMove(entities, oldIndex, newIndex));
  };

  // A folder's id opens its panel; an entity's opens the tabbed one.
  const shown = (id: string | null) => {
    const group = entityGroups.find((g) => g.id === id);
    return group ? { group } : { entity: entities.find((e) => e.id === id) };
  };

  const detail = (id: string | null) => {
    const { group, entity } = shown(id);
    if (group) return <EntityGroupManager key={group.id} group={group} />;
    return entity && (
      <EntityManager
        key={entity.id}
        entity={entity}
        tab={tab}
        onTabChange={onTabChange}
        traitId={traitId}
        onTraitIdChange={onTraitIdChange}
        placeholderId={placeholderId}
        onPlaceholderIdChange={onPlaceholderIdChange}
        onOpenWorldPlaceholder={onOpenWorldPlaceholder}
        focusField={focusFieldForItem(focusField, entity.id)}
      />
    );
  };

  const adapter: ListEditorAdapter = {
    tree: <EntityTree selectedId={selectedId} onSelect={onSelect} />,
    rows,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    noun: 'entities',
    detail,
    // The tabbed entity panel keeps its strip above a body that scrolls itself.
    fills: (id) => !!shown(id).entity,
    onReorder,
    add: advanced ? {
      label: 'Add to Entities',
      menu: (
        <>
          <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label="Add Group" onAdd={handleAddGroup} />
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label="Add Entity" onAdd={handleAddEntity} />
        </>
      ),
    } : { label: 'Add to Entities', onAdd: handleAddEntity },
    placeholder: 'Search or add new entities',
    holds: (id) => { const { group, entity } = shown(id); return !!(group ?? entity); },
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
  return { adapter, dialog };
}
