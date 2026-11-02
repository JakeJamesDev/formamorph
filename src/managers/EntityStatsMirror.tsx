import { useMemo } from 'react';
import { Hint } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import type { Entity } from '@/types';
import EntityStatsEditor from './EntityStatsEditor';
import { useOwnedStatDelete } from './useOwnedStatDelete';

/**
 * The entity panel's Stats tab: the shared entity stats editor over one world entity, stacked so a selected
 * stat's details slide in over the list. Its links read the world's Blueprints live, and every write lands on
 * the entity through the world's entity edit. The World Editor holds the selection, as it holds the panel's
 * tab, since the panel remounts per entity.
 */
const EntityStatsMirror = ({ entity, selectedId, onSelect }: {
  entity: Entity;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const { stats, statGroups, placeholders, placementLetters, placeholderOwners, editEntity } = useGameData();
  const world = useMemo(() => ({ stats, statGroups }), [stats, statGroups]);
  const { ask, dialog } = useOwnedStatDelete();
  return (
    <>
      <EntityStatsEditor
        entity={entity}
        world={world}
        edit={(change) => editEntity(entity.id, change)}
        confirmRemove={(change, name) => ask(entity.id, change, name)}
        names={{ placeholders, letters: placementLetters, owners: placeholderOwners }}
        layout="stacked"
        selectedId={selectedId}
        onSelect={onSelect}
        canLink
        placeholder="Filter Stats"
        emptyHint={<Hint className="p-2">Add a stat to track something about this entity</Hint>}
      />
      {dialog}
    </>
  );
};

export default EntityStatsMirror;
