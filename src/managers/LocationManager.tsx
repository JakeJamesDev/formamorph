import { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import GenerateSummaryButton from "@/components/GenerateSummaryButton";
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
        <Label>Player-Facing Description</Label>
        <Textarea
          value={editingLocation.playerDescription || ''}
          onChange={(e) => handleChange('playerDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <Textarea
          value={editingLocation.aiDescription || ''}
          onChange={(e) => handleChange('aiDescription', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>AI-Facing Summary</Label>
          <GenerateSummaryButton
            source={editingLocation.aiDescription}
            current={editingLocation.aiSummary}
            onGenerated={(s) => handleChange('aiSummary', s)}
          />
        </div>
        <Textarea
          value={editingLocation.aiSummary || ''}
          onChange={(e) => handleChange('aiSummary', e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          A one-line version used where the full description is too long — keep it brief.
        </p>
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
