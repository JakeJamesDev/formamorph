import { useState, useEffect, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { ImageUpload, ModelUpload } from '../lib/UtilityComponents';
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
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={editingEntity.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>In-Game Description</Label>
        <Textarea
          value={editingEntity.inGameDescription || ''}
          onChange={(e) => handleChange('inGameDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Detailed Description (for AI)</Label>
        <Textarea
          value={editingEntity.detailedDescription || ''}
          onChange={(e) => handleChange('detailedDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Input
          value={editingEntity.type || ''}
          onChange={(e) => handleChange('type', e.target.value)}
          placeholder="Enter entity type"
        />
      </div>
      <div className="space-y-2">
        <Label>Locations</Label>
        <MultiSelect
          key={entity.id}
          options={locations.map((l) => ({ label: l.name, value: l.id }))}
          defaultValue={selectedLocationIds}
          onValueChange={handleLocationsChange}
          placeholder="Select locations"
          hideSelectAll
        />
      </div>
      <div className="space-y-2">
        <Label>Image</Label>
        <ImageUpload
          onChange={(file) => handleChange('image', file)}
          id={`entity-image-${editingEntity.id}`}
          value={editingEntity.image}
        />
      </div>
      {/* <div className="space-y-2">
        <Label>Sound</Label>
        <SoundUpload
          onChange={(file) => handleChange('sound', file)}
          id={`entity-sound-${editingEntity.id}`}
          value={editingEntity.sound}
        />
      </div> */}
      <div className="space-y-2">
        <Label>3D Model</Label>
        <ModelUpload
          model={editingEntity.model}
          onModelChange={(model) => handleChange('model', model)}
          uniqueId={`entity-${editingEntity.id}`}
        />
      </div>
    </div>
  );
};

export default EntityManager;
