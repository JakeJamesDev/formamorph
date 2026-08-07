import { useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import EntityFields from './EntityFields';
import { useEditingDraft } from '@/lib/useEditingDraft';
import type { Entity } from '@/types';
import { labelPlaceholders } from '@/lib/placeholders';

const EntityManager = ({ entity }: { entity: Entity }) => {
  const { updateEntity, locations, updateLocation, placeholders } = useGameData();
  const { draft: editingEntity, setField: handleChange } = useEditingDraft<Entity>(entity, updateEntity);

  // Entity↔location link lives only on each location's `entities` array; derive the entity's
  // memberships and write changes back into the relevant locations.
  const selectedLocationIds = useMemo(
    () => locations.filter((l) => (l.entities ?? []).includes(entity.id)).map((l) => l.id),
    [locations, entity.id],
  );

  const handleLocationsChange = (ids: string[]) => {
    const next = new Set(ids);
    locations.forEach((loc) => {
      const has = (loc.entities ?? []).includes(entity.id);
      const should = next.has(loc.id);
      if (has === should) return;
      const nextEntities = should
        ? [...(loc.entities ?? []), entity.id]
        : (loc.entities ?? []).filter((id) => id !== entity.id);
      updateLocation({ ...loc, entities: nextEntities });
    });
  };

  if (!editingEntity) return null;

  return (
    <EntityFields
      value={editingEntity}
      onChange={handleChange}
      placeholders={placeholders}
      locationOptions={locations.map((l) => ({ label: labelPlaceholders(l.name, placeholders), value: l.id }))}
      selectedLocationIds={selectedLocationIds}
      onLocationsChange={handleLocationsChange}
    />
  );
};

export default EntityManager;
