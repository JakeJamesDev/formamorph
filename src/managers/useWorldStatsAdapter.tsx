import { FilePlus, FolderPlus } from 'lucide-react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { ListMenuRow } from '@/components/ListToolbar';
import type { ListSearch } from '@/components/listToolbarHooks';
import { useGameData } from '@/contexts/GameDataContext';
import { newStat } from '@/lib/blankWorld';
import { useEditorMode } from '@/lib/editorMode';
import { duplicateStatNode, newStatGroup, statRootCount } from '@/lib/statGroupTree';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import { EmptyListHint } from '@/components/EmptyListHint';
import { statListAdapter } from './statListAdapter';

/** The World Editor's Stats tab as a List Editor adapter: the folder tree, a flat search and the stat panel. */
export function useWorldStatsAdapter({ selectedId, onSelect, search, tab, onTabChange, focusField }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The World Editor's shared search, which hides the open stat while it leaves the stat out. */
  search: ListSearch;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
  focusField: FocusFieldHint | null;
}): ListEditorAdapter {
  const {
    stats, statGroups, placeholders, placementLetters, placeholderOwners, addStat, addStatGroup, updateStatGroup, removeStat,
    removeStatGroup, setStats, setStatGroups,
  } = useGameData();
  const { advanced } = useEditorMode();

  // New stats and groups append at the root; the author drags them into folders.
  const handleAdd = (typed: string) => {
    const id = randomUUID();
    addStat({ ...newStat(id, typed || undefined), groupId: null, order: statRootCount(statGroups, stats) });
    onSelect(id);
  };
  const handleAddGroup = (typed: string) => {
    const id = randomUUID();
    addStatGroup(newStatGroup(id, statRootCount(statGroups, stats), typed || undefined));
    onSelect(id);
  };
  // The copy lands right after its original; a group brings its stats and subgroups.
  const handleDuplicate = (id: string) => {
    const next = duplicateStatNode(statGroups, stats, id);
    if (next.newId === id) return;
    setStatGroups(next.groups);
    setStats(next.stats);
    onSelect(next.newId);
  };

  return statListAdapter({
    stats,
    groups: statGroups,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    selectedId,
    onSelect,
    onDuplicate: handleDuplicate,
    onRemoveStat: removeStat,
    onRemoveGroup: removeStatGroup,
    onDrop: (next) => {
      setStatGroups(next.groups);
      setStats(next.stats);
    },
    onWriteGroup: updateStatGroup,
    add: advanced ? {
      label: 'Add to Stats',
      menu: (
        <>
          <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label="Add Group" onAdd={handleAddGroup} />
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label="Add Stat" onAdd={handleAdd} />
        </>
      ),
    } : { label: 'Add to Stats', onAdd: handleAdd },
    placeholder: 'Filter Stats',
    emptyHint: <EmptyListHint noun="stats" action={advanced ? 'add a group or stat' : 'add one'} />,
    search,
    tab,
    onTabChange,
    focusField,
  });
}
