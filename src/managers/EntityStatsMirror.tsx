import { useState } from 'react';
import { FilePlus, FolderPlus } from 'lucide-react';
import { ListEditor } from '@/components/ListEditor';
import { ListMenuRow } from '@/components/ListToolbar';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import {
  addOwnedStat, addOwnedStatGroup, duplicateOwnedStatNode, removeOwnedStat, removeOwnedStatGroup,
  updateOwnedStat, updateOwnedStatGroup, withOwnedStatTree,
} from '@/lib/ownedStats';
import { labelPlaceholders } from '@/lib/placementLetters';
import { randomUUID } from '@/lib/uuid';
import type { Entity, Stat, StatGroup } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import type { StatEditorStore } from './StatManager';
import { statListAdapter } from './statListAdapter';

const NO_STATS: Stat[] = [];
const NO_GROUPS: StatGroup[] = [];

/**
 * The entity panel's Stats tab: the Stats tab's tree, toolbar and stat panel over one world entity, stacked so
 * a selected stat's details slide in over the list. Every write lands on the entity through the world's entity
 * edit. The World Editor holds the selection, as it holds the panel's tab, since the panel remounts per entity;
 * the list clears one the entity doesn't hold.
 */
const EntityStatsMirror = ({ entity, selectedId, onSelect }: {
  entity: Entity;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const { placeholders, placementLetters, placeholderOwners, editEntity } = useGameData();
  const [tab, setTab] = useState<StatPanelTab>('details');
  const stats = entity.stats ?? NO_STATS;
  const groups = entity.statGroups ?? NO_GROUPS;

  const edit = (change: (e: Entity) => Entity) => editEntity(entity.id, change);
  const store: StatEditorStore = {
    stats,
    updateStat: (stat) => edit((e) => updateOwnedStat(e, stat)),
    morphOwner: { name: labelPlaceholders(entity.name, placeholders), model: entity.model },
  };

  const adapter = statListAdapter({
    stats,
    groups,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    selectedId,
    onSelect,
    onDuplicate: (id) => {
      const { entity: next, newId } = duplicateOwnedStatNode(entity, id);
      if (newId === id) return;
      edit(() => next);
      onSelect(newId);
    },
    onRemoveStat: (id) => edit((e) => removeOwnedStat(e, id)),
    onRemoveGroup: (id) => edit((e) => removeOwnedStatGroup(e, id)),
    onDrop: (next) => edit((e) => withOwnedStatTree(e, next.stats, next.groups)),
    onWriteGroup: (group) => edit((e) => updateOwnedStatGroup(e, group)),
    add: {
      label: `Add to ${labelPlaceholders(entity.name, placeholders)}`,
      menu: (
        <>
          <ListMenuRow
            icon={<FolderPlus className="h-4 w-4" />}
            label="Add Group"
            onAdd={(typed) => {
              const id = randomUUID();
              edit((e) => addOwnedStatGroup(e, id, typed || undefined));
              onSelect(id);
            }}
          />
          <ListMenuRow
            icon={<FilePlus className="h-4 w-4" />}
            label="Add Stat"
            onAdd={(typed) => {
              const id = randomUUID();
              edit((e) => addOwnedStat(e, id, typed || undefined));
              onSelect(id);
            }}
          />
        </>
      ),
    },
    placeholder: 'Filter Stats',
    emptyHint: <Hint className="p-2">Add a stat to track something about this entity</Hint>,
    tab,
    onTabChange: setTab,
    store,
    padded: true,
  });

  return <ListEditor adapter={adapter} layout="stacked" selectedId={selectedId} onSelect={onSelect} backLabel="Stats" />;
};

export default EntityStatsMirror;
