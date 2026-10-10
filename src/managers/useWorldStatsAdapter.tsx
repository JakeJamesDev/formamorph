import { EmptyListHint } from '@/components/EmptyListHint';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { useGameData } from '@/contexts/GameDataContext';
import { newStat } from '@/lib/blankWorld';
import { withStatCopy, withStatMoved } from '@/lib/ownedStats';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import { statListAdapter } from './statListAdapter';

/** The World Editor's Stats tab as a List Editor adapter: one flat, sortable list and the stat panel. */
export function useWorldStatsAdapter({ onSelect, search, tab, onTabChange, focusField }: {
  onSelect: (id: string | null) => void;
  /** The World Editor's shared search, which hides the open stat while it leaves the stat out. */
  search: ListSearch;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
  focusField: FocusFieldHint | null;
}): ListEditorAdapter {
  const { stats, placeholders, placementLetters, placeholderOwners, addStat, removeStat, setStats } = useGameData();

  const handleAdd = (typed: string) => {
    const id = randomUUID();
    addStat(newStat(id, typed || undefined));
    onSelect(id);
  };
  // The copy lands right after its original.
  const handleDuplicate = (id: string) => {
    const copyId = randomUUID();
    const next = withStatCopy(stats, id, copyId);
    if (next === stats) return;
    setStats(next);
    onSelect(copyId);
  };

  const onReorder = (activeId: string, overId: string) => {
    const next = withStatMoved(stats, activeId, overId);
    if (next !== stats) setStats(next);
  };

  return statListAdapter({
    stats,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    onSelect,
    onDuplicate: handleDuplicate,
    onRemove: removeStat,
    onReorder,
    add: { label: 'Add to Stats', onAdd: handleAdd },
    placeholder: 'Filter Stats',
    emptyHint: <EmptyListHint noun="stats" />,
    search,
    tab,
    onTabChange,
    focusField,
  });
}
