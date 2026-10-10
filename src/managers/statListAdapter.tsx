import type { ReactNode } from 'react';
import { Copy, X } from 'lucide-react';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { matchesListSearch, type ListSearchNames } from '@/lib/listSearch';
import type { FocusFieldHint, Stat } from '@/types';
import { focusFieldForItem } from '@/views/findFocus';
import type { StatPanelTab } from '@/views/statPanelTabs';
import StatManager, { type StatEditorStore } from './StatManager';

/**
 * A flat, sortable list of stats and the stat panel, as a List Editor adapter. The Stats tab runs it over the
 * world's stats and the entity panel's Stats tab over one entity's, so both draw the same rows and panel.
 */
export function statListAdapter({
  stats, names, onSelect, onDuplicate, onRemove, onReorder, add, placeholder, emptyHint, search, tab, onTabChange, focusField, store, padded,
}: {
  stats: Stat[];
  names: ListSearchNames;
  onSelect: (id: string | null) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  add: ListEditorAdapter['add'];
  placeholder: string;
  emptyHint: ReactNode;
  /** The host's shared search, which hides the open stat while it leaves the stat out. */
  search?: ListSearch;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
  focusField?: FocusFieldHint | null;
  /** Where the stat panel reads and writes: an entity's own stats. Absent = the world's. */
  store?: StatEditorStore;
  /** The panel sits in a pane that scrolls and pads it, as the entity panel's other tabs do. */
  padded?: boolean;
}): ListEditorAdapter {
  const rows = (): ListEditorRow[] => stats.map((s) => ({
    id: s.id,
    name: s.name,
    sortable: true,
    actions: [
      { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => onDuplicate(s.id) },
      { icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete', onClick: () => { onRemove(s.id); onSelect(null); } },
    ],
  }));

  // A search that leaves the open stat out blanks its detail (drift log #2).
  const shown = (id: string | null) => {
    const stat = id ? stats.find((s) => s.id === id) : undefined;
    return stat && (!search || matchesListSearch(stat.name, search.term, names)) ? stat : undefined;
  };

  return {
    rows,
    names,
    noun: 'stats',
    detail: (id) => {
      const stat = shown(id);
      const panel = stat && (
        <StatManager
          key={stat.id}
          stat={stat}
          tab={tab}
          onTabChange={onTabChange}
          focusField={focusFieldForItem(focusField ?? null, stat.id)}
          store={store}
        />
      );
      return panel && padded ? <div className="p-4">{panel}</div> : panel;
    },
    // The tabbed panel keeps its strip above a body that scrolls itself, where the host gives it no padding.
    fills: padded ? undefined : (id) => !!shown(id),
    onReorder,
    add,
    placeholder,
    holds: (id) => stats.some((s) => s.id === id),
    isEmpty: stats.length === 0,
    emptyHint,
  };
}
