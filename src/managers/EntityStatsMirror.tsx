import { useState } from 'react';
import { FilePlus } from 'lucide-react';
import { ListEditor } from '@/components/ListEditor';
import { ListMenuRow } from '@/components/ListToolbar';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import {
  addOwnedStat, duplicateOwnedStat, moveOwnedStat, removeOwnedStat, updateOwnedStat,
} from '@/lib/ownedStats';
import { labelPlaceholders } from '@/lib/placementLetters';
import { randomUUID } from '@/lib/uuid';
import type { Entity, Stat } from '@/types';
import type { StatPanelTab } from '@/views/statPanelTabs';
import type { StatEditorStore } from './StatManager';
import { statListAdapter } from './statListAdapter';

/**
 * The entity panel's Stats tab: the Stats tab's rows, toolbar and stat panel over one world entity, stacked so
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
  const stats: Stat[] = entity.stats ?? [];

  const edit = (change: (e: Entity) => Entity) => editEntity(entity.id, change);
  const store: StatEditorStore = { stats, updateStat: (stat) => edit((e) => updateOwnedStat(e, stat)) };

  const adapter = statListAdapter({
    stats,
    names: { placeholders, letters: placementLetters, owners: placeholderOwners },
    onSelect,
    onDuplicate: (id) => {
      const copyId = randomUUID();
      edit((e) => duplicateOwnedStat(e, id, copyId));
      onSelect(copyId);
    },
    onRemove: (id) => edit((e) => removeOwnedStat(e, id)),
    onReorder: (activeId, overId) => edit((e) => moveOwnedStat(e, activeId, overId)),
    add: {
      label: `Add to ${labelPlaceholders(entity.name, placeholders)}`,
      menu: (
        <ListMenuRow
          icon={<FilePlus className="h-4 w-4" />}
          label="Add Stat"
          onAdd={(typed) => {
            const id = randomUUID();
            edit((e) => addOwnedStat(e, id, typed || undefined));
            onSelect(id);
          }}
        />
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
