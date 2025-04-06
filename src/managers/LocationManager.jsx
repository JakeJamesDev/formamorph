import React, { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload, SoundUpload } from '../lib/UtilityComponents';

const LocationManager = ({ location }) => {
  const { updateLocation, entities } = useGameData();
  const [editingLocation, setEditingLocation] = useState(location);

  useEffect(() => {
    setEditingLocation(location);
  }, [location]);

  const handleChange = (field, value) => {
    const updatedLocation = { ...editingLocation, [field]: value };
    setEditingLocation(updatedLocation);
    updateLocation(updatedLocation);
  };

  if (!editingLocation) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={editingLocation.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>In-Game Description</Label>
        <Textarea
          value={editingLocation.inGameDescription || ''}
          onChange={(e) => handleChange('inGameDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Detailed Description (for AI)</Label>
        <Textarea
          value={editingLocation.detailedDescription || ''}
          onChange={(e) => handleChange('detailedDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Background Image</Label>
        <ImageUpload
          onChange={(file) => handleChange('backgroundImage', file)}
          id={`location-image-${editingLocation.id}`}
          value={editingLocation.backgroundImage}
        />
      </div>
      <div className="space-y-2">
        <Label>Ambient Sound</Label>
        <SoundUpload
          onChange={(file) => handleChange('ambientSound', file)}
          id={`location-sound-${editingLocation.id}`}
          value={editingLocation.ambientSound}
        />
      </div>
      <div className="space-y-2">
        <Label>Entity</Label>
        <div className="space-y-2">
          {entities.map(entity => (
            <div key={entity.id} className="flex items-center space-x-2">
              <Checkbox
                id={`entity-${entity.id}`}
                checked={(editingLocation.entities || []).includes(entity.id)}
                onCheckedChange={(checked) => {
                  const updatedEntities = checked
                    ? [...(editingLocation.entities || []), entity.id]
                    : (editingLocation.entities || []).filter(id => id !== entity.id);
                  handleChange('entities', updatedEntities);
                }}
              />
              <Label htmlFor={`entity-${entity.id}`}>{entity.name}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LocationManager;
