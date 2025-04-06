import React, { useState, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload, SoundUpload, ModelUpload } from '../lib/UtilityComponents';

const EntityManager = ({ entity }) => {
  const { updateEntity } = useGameData();
  const [editingEntity, setEditingEntity] = useState(entity);

  useEffect(() => {
    setEditingEntity(entity);
  }, [entity]);

  const handleChange = (field, value) => {
    const updatedEntity = { ...editingEntity, [field]: value };
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