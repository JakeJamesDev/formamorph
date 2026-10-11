import type { ReactNode } from 'react';
import { Copy, Link2, X } from 'lucide-react';
import type { LinkedStatRow } from '@/lib/statLinks';
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
  stats, groups, names, selectedId, onSelect, onDuplicate, onRemoveStat, onRemoveGroup, tree, onWriteGroup, add, placeholder,
  emptyHint, search, tab, onTabChange, focusField, store, padded, links, footer,
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
  /** The one-owner tree, with where its drops land (the stats come back in tree order), or a tree of the
   *  caller's that writes its own drops. */
  tree: { onDrop: (next: { groups: StatGroup[]; stats: Stat[] }) => void } | { node: ReactNode };
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
  /** The rows among `stats` and `groups` that an entity's links bring, with the panel and footer each opens. */
  links?: {
    rows: ReadonlyMap<string, LinkedStatRow>;
    detail: (id: string) => ReactNode;
    footer: (id: string) => ReactNode;
    onDetach: (linkId: string) => void;
  };
  /** The footer under any other row's panel. */
  footer?: (id: string) => ReactNode;
}): ListEditorAdapter {
  // A search lists stats only. Order is the tree's to change, so these rows draw no grip.
  const rows = (): ListEditorRow[] => stats.map((s) => {
    const remove = { icon: <X className="h-4 w-4" />, destructive: true, onClick: () => { onRemoveStat(s.id); onSelect(null); } };
    const linked = links?.rows.get(s.id);
    if (linked && !linked.root) return { id: s.id, name: s.name, icon: <Link2 className="h-4 w-4 shrink-0 opacity-50" aria-label="Linked" />, actions: [] };
    return linked
      ? { id: s.id, name: s.name, icon: <Link2 className="h-4 w-4 shrink-0" aria-label="Link" />, actions: [{ ...remove, title: 'Remove Link' }] }
      : {
        id: s.id,
        name: s.name,
        actions: [{ icon: <Copy className="h-4 w-4" />, title: 'Duplicate', onClick: () => onDuplicate(s.id) }, { ...remove, title: 'Delete' }],
      };
  });

  // A search that leaves the open stat out blanks its detail (drift log #2).
  const shown = (id: string | null) => {
    const stat = id ? stats.find((s) => s.id === id) : undefined;
    return stat && (!search || matchesListSearch(stat.name, search.term, names)) ? stat : undefined;
  };

  return {
    tree: 'node' in tree ? tree.node : (
      <StatTree
        stats={stats}
        groups={groups}
        selectedId={selectedId}
        onSelect={onSelect}
        onDrop={tree.onDrop}
        onRemoveStat={onRemoveStat}
        onRemoveGroup={onRemoveGroup}
        onDuplicate={onDuplicate}
        linked={links?.rows}
        onDetach={links?.onDetach}
        emptyHint={emptyHint}
      />
    ),
    rows,
    names,
    noun: 'stats',
    detail: (id) => {
      if (!id) return null;
      const group = groups.find((g) => g.id === id);
      const stat = shown(id);
      const panel = links?.rows.has(id) && (stat ?? group) ? links.detail(id) : group
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
    footer: links || footer ? (id) => (links?.rows.has(id) ? links.footer(id) : footer?.(id)) : undefined,
    add,
    placeholder,
    holds: (id) => stats.some((s) => s.id === id) || groups.some((g) => g.id === id),
    // The tree draws its own empty hint.
    isEmpty: false,
    emptyHint: null,
  };
}
