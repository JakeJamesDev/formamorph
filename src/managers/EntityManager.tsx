import { useState, useEffect, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import EntityFields from './EntityFields';
import type { Entity } from '@/types';

const EntityManager = ({ entity }: { entity: Entity }) => {
  const { updateEntity, locations, updateLocation } = useGameData();
  const [editingEntity, setEditingEntity] = useState<Entity>(entity);

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

  useEffect(() => {
    setEditingEntity(entity);
  }, [entity]);

  const handleChange = (field: string, value: unknown) => {
    const updatedEntity = { ...editingEntity, [field]: value } as Entity;
    setEditingEntity(updatedEntity);
    updateEntity(updatedEntity);
  };

  if (!editingEntity) return null;

  return (
    <EntityFields
      value={editingEntity}
      onChange={handleChange}
      locationOptions={locations.map((l) => ({ label: l.name, value: l.id }))}
      selectedLocationIds={selectedLocationIds}
      onLocationsChange={handleLocationsChange}
    />
  );
};

export default EntityManager;
