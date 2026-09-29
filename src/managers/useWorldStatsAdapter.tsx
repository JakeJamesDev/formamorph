import { arrayMove } from '@dnd-kit/sortable';
import { Copy, X } from 'lucide-react';
import { EmptyListHint } from '@/components/EmptyListHint';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { useGameData } from '@/contexts/GameDataContext';
import { newStat } from '@/lib/blankWorld';
import { matchesListSearch } from '@/lib/listSearch';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint } from '@/types';
import { focusFieldForItem } from '@/views/findFocus';
import type { StatPanelTab } from '@/views/statPanelTabs';
import StatManager from './StatManager';

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
  const names = { placeholders, letters: placementLetters, owners: placeholderOwners };

  const handleAdd = (typed: string) => {
    const id = randomUUID();
    addStat(newStat(id, typed || undefined));
    onSelect(id);
  };
  // The copy lands right after its original.
  const handleDuplicate = (id: string) => {
    const index = stats.findIndex((s) => s.id === id);
    if (index === -1) return;
    const copy = { ...structuredClone(stats[index]), id: randomUUID() };
    copy.name = `${copy.name} (Copy)`;
    setStats([...stats.slice(0, index + 1), copy, ...stats.slice(index + 1)]);
    onSelect(copy.id);
  };

  const rows = (): ListEditorRow[] => stats.map((s) => ({
    id: s.id,
    name: s.name,
    sortable: true,
    actions: [
      { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => handleDuplicate(s.id) },
      { icon: <X className="h-4 w-4" />, title: 'Delete', onClick: () => { removeStat(s.id); onSelect(null); } },
    ],
  }));

  const onReorder = (activeId: string, overId: string) => {
    const oldIndex = stats.findIndex((s) => s.id === activeId);
    const newIndex = stats.findIndex((s) => s.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    setStats(arrayMove(stats, oldIndex, newIndex));
  };

  // A search that leaves the open stat out blanks its detail (drift log #2).
  const shown = (id: string | null) => {
    const stat = id ? stats.find((s) => s.id === id) : undefined;
    return stat && matchesListSearch(stat.name, search.term, names) ? stat : undefined;
  };

  return {
    rows,
    names,
    noun: 'stats',
    detail: (id) => {
      const stat = shown(id);
      return stat && (
        <StatManager
          key={stat.id}
          stat={stat}
          tab={tab}
          onTabChange={onTabChange}
          focusField={focusFieldForItem(focusField, stat.id)}
        />
      );
    },
    // The tabbed panel keeps its strip above a body that scrolls itself.
    fills: (id) => !!shown(id),
    onReorder,
    add: { label: 'Add to Stats', onAdd: handleAdd },
    placeholder: 'Search or add new stats',
    holds: (id) => stats.some((s) => s.id === id),
    isEmpty: stats.length === 0,
    emptyHint: <EmptyListHint noun="stats" />,
  };
}
