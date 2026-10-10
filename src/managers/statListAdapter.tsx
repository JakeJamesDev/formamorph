import type { ReactNode } from 'react';
import { Copy, X } from 'lucide-react';
import type { ListEditorAdapter, ListEditorRow } from '@/components/listEditorHooks';
import type { ListSearch } from '@/components/listToolbarHooks';
import { matchesListSearch, type ListSearchNames } from '@/lib/listSearch';
import type { FocusFieldHint, Stat, StatGroup } from '@/types';
import { focusFieldForItem } from '@/views/findFocus';
import type { StatPanelTab } from '@/views/statPanelTabs';
import StatGroupManager from './StatGroupManager';
import StatManager, { type StatEditorStore } from './StatManager';
import StatTree from './StatTree';

/**
 * The stat folder tree, a flat search over its stats and the stat or group panel, as a List Editor adapter. The
 * Stats tab runs it over the world's stats and the entity panel's Stats tab over one entity's, so both draw
 * the same rows and panels.
 */
export function statListAdapter({
  stats, groups, names, selectedId, onSelect, onDuplicate, onRemoveStat, onRemoveGroup, onDrop, onWriteGroup, add, placeholder,
  emptyHint, search, tab, onTabChange, focusField, store, padded,
}: {
  stats: Stat[];
  groups: StatGroup[];
  names: ListSearchNames;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Copies a stat or a whole group and selects the copy. */
  onDuplicate: (id: string) => void;
  onRemoveStat: (id: string) => void;
  onRemoveGroup: (id: string) => void;
  /** Writes the groups and stats a drag produced; the stats come back in tree order. */
  onDrop: (next: { groups: StatGroup[]; stats: Stat[] }) => void;
  onWriteGroup: (group: StatGroup) => void;
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
  // A search lists stats only. Order is the tree's to change, so these rows draw no grip.
  const rows = (): ListEditorRow[] => stats.map((s) => ({
    id: s.id,
    name: s.name,
    actions: [
      { icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => onDuplicate(s.id) },
      { icon: <X className="h-4 w-4" />, destructive: true, title: 'Delete', onClick: () => { onRemoveStat(s.id); onSelect(null); } },
    ],
  }));

  // A search that leaves the open stat out blanks its detail (drift log #2).
  const shown = (id: string | null) => {
    const stat = id ? stats.find((s) => s.id === id) : undefined;
    return stat && (!search || matchesListSearch(stat.name, search.term, names)) ? stat : undefined;
  };

  return {
    tree: (
      <StatTree
        stats={stats}
        groups={groups}
        selectedId={selectedId}
        onSelect={onSelect}
        onDrop={onDrop}
        onRemoveStat={onRemoveStat}
        onRemoveGroup={onRemoveGroup}
        onDuplicate={onDuplicate}
        emptyHint={emptyHint}
      />
    ),
    rows,
    names,
    noun: 'stats',
    detail: (id) => {
      const group = id ? groups.find((g) => g.id === id) : undefined;
      const stat = shown(id);
      const panel = group
        ? <StatGroupManager key={group.id} group={group} write={onWriteGroup} />
        : stat && (
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
    add,
    placeholder,
    holds: (id) => stats.some((s) => s.id === id) || groups.some((g) => g.id === id),
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
}
