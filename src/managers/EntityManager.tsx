import { useState, useEffect, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import GenerateSummaryButton from "@/components/GenerateSummaryButton";
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
        <Label>Player-Facing Description</Label>
        <Textarea
          value={editingEntity.playerDescription || ''}
          onChange={(e) => handleChange('playerDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <Textarea
          value={editingEntity.aiDescription || ''}
          onChange={(e) => handleChange('aiDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>AI-Facing Summary</Label>
          <GenerateSummaryButton
            source={editingEntity.aiDescription}
            current={editingEntity.aiSummary}
            onGenerated={(s) => handleChange('aiSummary', s)}
          />
        </div>
        <Textarea
          value={editingEntity.aiSummary || ''}
          onChange={(e) => handleChange('aiSummary', e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          A one-line version used where the full description is too long — keep it brief.
        </p>
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
