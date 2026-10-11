import { useState, type ReactNode } from 'react';
import { FilePlus, FolderPlus } from 'lucide-react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { ListMenuRow } from '@/components/ListToolbar';
import type { ListSearch } from '@/components/listToolbarHooks';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useGameData } from '@/contexts/GameDataContext';
import { newStat } from '@/lib/blankWorld';
import { BlueprintIcon } from '@/lib/elementIcons';
import { useEditorMode } from '@/lib/editorMode';
import { labelPlaceholders } from '@/lib/placementLetters';
import { duplicateStatNode, newStatGroup, statRootCount } from '@/lib/statGroupTree';
import {
  dropKeepsBlueprints, removeStatBlueprints, statBlueprintsGroup, statLinksTo, statOriginalOf, type StatBlueprintsRemoval,
} from '@/lib/statLinks';
import { alsoDeletesLinks } from './useRemoveWorldTrait';
import { StatLinkToButton } from './BearerPicker';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint, Stat } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import { EmptyListHint } from '@/components/EmptyListHint';
import { statListAdapter } from './statListAdapter';

/** What removing the Blueprints stat group does to the links and the stats it holds. */
function blueprintsLine({ detached, movedUp }: StatBlueprintsRemoval): string {
  return [
    detached ? `${detached === 1 ? "Its link becomes that entity's own stat" : `Its ${detached} links become each entity's own stat`}, and Remove deletes the linked originals.` : '',
    movedUp ? `${detached ? 'The other stats move' : 'Its stats move'} to the top level, where they become player stats.` : '',
  ].filter(Boolean).join(' ');
}

type Pending = { id: string; name: string; isGroup: boolean; description: string };

/** The World Editor's Stats tab as a List Editor adapter: the folder tree, a flat search and the stat panel.
 *  `dialog` is the confirmation a linked Blueprint's delete opens. */
export function useWorldStatsAdapter({ selectedId, onSelect, search, tab, onTabChange, focusField }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The World Editor's shared search, which hides the open stat while it leaves the stat out. */
  search: ListSearch;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
  focusField: FocusFieldHint | null;
}): { adapter: ListEditorAdapter; dialog: ReactNode } {
  const {
    stats, statGroups, entities, placeholders, placementLetters, placeholderOwners, addStat, addStatGroup, updateStatGroup, removeStat,
    removeStatGroup, setStats, setStatGroups,
  } = useGameData();
  const { advanced } = useEditorMode();
  const [pending, setPending] = useState<Pending | null>(null);

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
  // The world holds at most one Blueprints group, so its add hides once it exists.
  const handleAddBlueprints = () => {
    const id = randomUUID();
    addStatGroup({ ...newStatGroup(id, statRootCount(statGroups, stats), 'Blueprints'), system: 'blueprints' });
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
  // A linked Blueprint stat or group takes its links with it, and Blueprints itself detaches them, so each asks first.
  const askRemoveStat = (id: string) => {
    const links = statLinksTo(entities, new Set([id]));
    if (!links) { removeStat(id); return; }
    const name = stats.find((s: Stat) => s.id === id)?.name ?? '';
    setPending({ id, name, isGroup: false, description: alsoDeletesLinks(links) });
  };
  const askRemoveGroup = (id: string) => {
    const group = statGroups.find((g) => g.id === id);
    const removal = group?.system === 'blueprints' ? removeStatBlueprints({ stats, statGroups }, entities) : null;
    const links = statLinksTo(entities, new Set([id]));
    const description = removal ? blueprintsLine(removal) : links ? alsoDeletesLinks(links) : '';
    if (!description) { removeStatGroup(id); return; }
    setPending({ id, name: group?.name ?? '', isGroup: true, description });
  };

  const adapter = statListAdapter({
    stats,
    groups: statGroups,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    selectedId,
    onSelect,
    onDuplicate: handleDuplicate,
    onRemoveStat: askRemoveStat,
    onRemoveGroup: askRemoveGroup,
    onDrop: (next) => {
      if (!dropKeepsBlueprints({ stats: next.stats, statGroups: next.groups }, entities)) return;
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
          {!statBlueprintsGroup(statGroups)
            && <ListMenuRow icon={<BlueprintIcon className="h-4 w-4" />} label="Add Blueprints Group" onAdd={handleAddBlueprints} />}
        </>
      ),
    } : { label: 'Add to Stats', onAdd: handleAdd },
    placeholder: 'Filter Stats',
    emptyHint: <EmptyListHint noun="stats" action={advanced ? 'add a group or stat' : 'add one'} />,
    search,
    tab,
    onTabChange,
    focusField,
    // In Advanced, a Blueprint stat or group links onto entities from here.
    footer: (id) => (advanced && statOriginalOf({ stats, statGroups }, id)
      ? <div className="p-3 border-t flex justify-end"><StatLinkToButton originalId={id} /></div>
      : null),
  });

  const name = labelPlaceholders(pending?.name ?? '', placeholders);
  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      title={pending?.isGroup ? `Remove ${name}?` : `Delete ${name}?`}
      description={pending?.description ?? ''}
      onConfirm={() => {
        if (pending) {
          if (pending.isGroup) removeStatGroup(pending.id);
          else removeStat(pending.id);
          if (pending.id === selectedId) onSelect(null);
        }
        setPending(null);
      }}
    />
  );
  return { adapter, dialog };
}
