import { useMemo, useState, type ReactNode } from 'react';
import { FilePlus, FolderPlus } from 'lucide-react';
import type { ListEditorAdapter } from '@/components/listEditorHooks';
import { ListMenuRow } from '@/components/ListToolbar';
import type { ListSearch } from '@/components/listToolbarHooks';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useGameData } from '@/contexts/GameDataContext';
import { newStat } from '@/lib/blankWorld';
import { BlueprintIcon } from '@/lib/elementIcons';
import { useEditorMode } from '@/lib/editorMode';
import { updateOwnedStatGroup } from '@/lib/ownedStats';
import { ownedStatTree } from '@/lib/ownedStatTree';
import { labelPlaceholders } from '@/lib/placementLetters';
import { duplicateStatNode, newStatGroup, statRootCount } from '@/lib/statGroupTree';
import {
  entityStatRows, removeStatBlueprints, resolvedEntityStats, statLinksTo, statOriginalOf,
  type StatBlueprintsRemoval,
} from '@/lib/statLinks';
import { blueprintsGroup } from '@/lib/blueprintGroups';
import type { FindingSection } from '@/lib/testBench/rules';
import { alsoDeletesLinks } from './useRemoveWorldTrait';
import { StatLinkToButton } from './OwnerPicker';
import { randomUUID } from '@/lib/uuid';
import type { FocusFieldHint, Stat } from '@/types';
import type { EntityPanelTab } from '@/views/entityPanelTabs';
import { focusFieldForItem } from '@/views/findFocus';
import type { StatPanelTab } from '@/views/statPanelTabs';
import { EmptyListHint } from '@/components/EmptyListHint';
import { EntityNodePanel } from './EntityNodePanel';
import { entityStatPanels } from './entityStatPanels';
import StatGroupManager from './StatGroupManager';
import StatManager from './StatManager';
import { statListAdapter } from './statListAdapter';
import WorldStatTree from './WorldStatTree';

/** What removing the Blueprints stat group does to the links and the stats it holds. */
function blueprintsLine({ detached, movedUp }: StatBlueprintsRemoval): string {
  return [
    detached ? `${detached === 1 ? "Its link becomes that entity's own stat" : `Its ${detached} links become each entity's own stat`}, and Remove deletes the linked originals.` : '',
    movedUp ? `${detached ? 'The other stats move' : 'Its stats move'} to the top level, where they become global stats.` : '',
  ].filter(Boolean).join(' ');
}

type Pending = { id: string; name: string; isGroup: boolean; description: string };

/** The World Editor's Stats tab as a List Editor adapter: the one tree with a node per entity that owns stats, a
 *  flat search over world stats, and the stat, group, entity node or Link panel for a selection. `dialog` is the
 *  confirmation a linked Blueprint's delete opens. */
export function useWorldStatsAdapter({ selectedId, onSelect, navigate, search, tab, onTabChange, focusField }: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Lands on an item the way a Bench finding does; `entityTab` names the entity panel's tab to open. */
  navigate: (section: FindingSection, id: string, entityTab?: EntityPanelTab) => void;
  /** The World Editor's shared search, which hides the open stat while it leaves the stat out. */
  search: ListSearch;
  tab: StatPanelTab;
  onTabChange: (tab: StatPanelTab) => void;
  focusField: FocusFieldHint | null;
}): { adapter: ListEditorAdapter; dialog: ReactNode } {
  const {
    stats, statGroups, entities, placeholders, placementLetters, placeholderOwners, addStat, addStatGroup, updateStatGroup, removeStat,
    removeStatGroup, setStats, setStatGroups, editEntity,
  } = useGameData();
  const { advanced } = useEditorMode();
  const [pending, setPending] = useState<Pending | null>(null);
  const world = useMemo(() => ({ stats, statGroups }), [stats, statGroups]);
  const tree = useMemo(() => ownedStatTree(world, entities, { emptySystemNodes: advanced }), [world, entities, advanced]);

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

  const emptyHint = <EmptyListHint noun="stats" action={advanced ? 'add a group or stat' : 'add one'} />;
  const base = statListAdapter({
    stats,
    groups: statGroups,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    selectedId,
    onSelect,
    onDuplicate: handleDuplicate,
    onRemoveStat: askRemoveStat,
    onRemoveGroup: askRemoveGroup,
    tree: {
      node: (
        <WorldStatTree
          tree={tree}
          selectedId={selectedId}
          onSelect={onSelect}
          world={{ onRemoveStat: askRemoveStat, onRemoveGroup: askRemoveGroup, onDuplicate: handleDuplicate }}
          emptyHint={emptyHint}
        />
      ),
    },
    onWriteGroup: updateStatGroup,
    add: advanced ? {
      label: 'Add to Stats',
      menu: (
        <>
          <ListMenuRow icon={<FolderPlus className="h-4 w-4" />} label="Add Group" onAdd={handleAddGroup} />
          <ListMenuRow icon={<FilePlus className="h-4 w-4" />} label="Add Stat" onAdd={handleAdd} />
          {!blueprintsGroup(statGroups)
            && <ListMenuRow icon={<BlueprintIcon className="h-4 w-4" />} label="Add Blueprints Group" onAdd={handleAddBlueprints} />}
        </>
      ),
    } : { label: 'Add to Stats', onAdd: handleAdd },
    placeholder: 'Filter Stats',
    emptyHint,
    search,
    tab,
    onTabChange,
    focusField,
    // In Advanced, a Blueprint stat or group links onto entities from here.
    footer: (id) => (advanced && statOriginalOf({ stats, statGroups }, id)
      ? <div className="p-3 border-t flex justify-end"><StatLinkToButton originalId={id} /></div>
      : null),
  });

  // An entity's row edits that entity, as its own Stats tab does; ids inside it are the entity's own.
  const ownedRow = (id: string | null) => {
    const row = id ? tree.owned.get(id) : undefined;
    const entity = row && entities.find((e) => e.id === row.entityId);
    if (!row || !entity) return null;
    const panels = entityStatPanels({
      entity,
      world,
      edit: (change) => editEntity(entity.id, change),
      rows: entityStatRows(world, entity),
      resolved: resolvedEntityStats(world, entity),
      placeholders,
      tab,
      onTabChange,
    });
    return { row, entity, panels };
  };
  const ownedDetail = (id: string): ReactNode => {
    const owned = ownedRow(id);
    if (!owned) return null;
    const { row, entity, panels } = owned;
    if (row.linked) return panels.linkDetail(row.id, id);
    const group = entity.statGroups?.find((g) => g.id === row.id);
    if (group) return <StatGroupManager key={id} group={group} write={(next) => editEntity(entity.id, (e) => updateOwnedStatGroup(e, next))} />;
    const stat = entity.stats?.find((s) => s.id === row.id);
    return stat && (
      <StatManager
        key={id}
        stat={stat}
        tab={tab}
        onTabChange={onTabChange}
        focusField={focusFieldForItem(focusField, row.id)}
        store={panels.store}
      />
    );
  };
  const adapter: ListEditorAdapter = {
    ...base,
    detail: (id) => {
      const node = id ? tree.entityNodes.get(id) : undefined;
      if (node) return <EntityNodePanel key={node.id} entity={node} onOpenEntity={() => navigate('entities', node.id, 'stats')} />;
      return id && tree.owned.has(id) ? ownedDetail(id) : base.detail(id);
    },
    footer: (id) => {
      if (!tree.owned.has(id)) return base.footer?.(id) ?? null;
      const owned = ownedRow(id);
      return owned?.row.linked ? owned.panels.linkFooter(owned.row.id) : null;
    },
    // A linked stat or an entity's own stat opens the tabbed stat panel, which scrolls itself.
    fills: (id) => {
      const row = tree.owned.get(id);
      if (!row) return !!base.fills?.(id);
      if (row.linked) return row.linked.kind === 'stat' && !row.linked.unbound;
      return !!entities.find((e) => e.id === row.entityId)?.stats?.some((s) => s.id === row.id);
    },
    holds: (id) => base.holds(id) || tree.entityNodes.has(id) || tree.owned.has(id),
  };

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
