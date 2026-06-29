import { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import { ImageUpload, SoundUpload } from '../lib/UtilityComponents';
import type { GameLocation } from '@/types';

const LocationManager = ({ location }: { location: GameLocation }) => {
  const { updateLocation, entities } = useGameData();
  const [editingLocation, setEditingLocation] = useState<GameLocation>(location);

  useEffect(() => {
    setEditingLocation(location);
  }, [location]);

  const handleChange = (field: string, value: unknown) => {
    const updatedLocation = { ...editingLocation, [field]: value } as GameLocation;
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
      <div className="flex items-center space-x-2">
        <Checkbox
          id={`location-starting-${editingLocation.id}`}
          checked={!!editingLocation.isStarting}
          onCheckedChange={(checked) => handleChange('isStarting', !!checked)}
        />
        <Label htmlFor={`location-starting-${editingLocation.id}`}>
          Starting location (new games may begin here)
        </Label>
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
        <Label>Entities</Label>
        <MultiSelect
          key={editingLocation.id}
          options={entities.map((e) => ({ label: e.name, value: e.id }))}
          defaultValue={editingLocation.entities ?? []}
          onValueChange={(v) => handleChange('entities', v)}
          placeholder="Select entities"
          hideSelectAll
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
    </div>
  );
};

export default LocationManager;
