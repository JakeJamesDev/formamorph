import { useState, useEffect } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import AiFieldToolbar from "@/components/AiFieldToolbar";
import { TagAutocomplete } from "@/components/TagAutocomplete";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { ImageUpload, SoundUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { GenerateImageButton } from '../components/GenerateImageButton';
import type { GameLocation } from '@/types';

const LocationManager = ({ location }: { location: GameLocation }) => {
  const { updateLocation, entities, placeholders } = useGameData();
  const [editingLocation, setEditingLocation] = useState<GameLocation>(location);
  // SD prompt pulled from an uploaded image, pending the user's OK to use it as Image Tags.
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

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
        <PlaceholderField
          value={editingLocation.playerDescription || ''}
          onChange={(v) => handleChange('playerDescription', v)}
          placeholders={placeholders}
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <PlaceholderField
          value={editingLocation.aiDescription || ''}
          onChange={(v) => handleChange('aiDescription', v)}
          placeholders={placeholders}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>AI-Facing Summary</Label>
          <AiFieldToolbar
            mode="summary"
            source={editingLocation.aiDescription}
            value={editingLocation.aiSummary}
            onChange={(s) => handleChange('aiSummary', s)}
          />
        </div>
        <PlaceholderField
          value={editingLocation.aiSummary || ''}
          onChange={(v) => handleChange('aiSummary', v)}
          placeholders={placeholders}
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
          cap={IMAGE_CAPS.background}
          onPromptExtracted={setPendingPrompt}
        />
        <ConfirmDialog
          open={pendingPrompt !== null}
          onOpenChange={(o) => { if (!o) setPendingPrompt(null); }}
          title="Use the image's prompt?"
          description="This image has an embedded AI prompt. Use it as the Image Tags? This replaces the current tags."
          onConfirm={() => { if (pendingPrompt) handleChange('imageTags', pendingPrompt); }}
          onCancel={() => setPendingPrompt(null)}
        />
        <div className="flex items-center justify-between">
          <Label>Image Tags</Label>
          <AiFieldToolbar
            mode="tags"
            name={editingLocation.name}
            kind="location"
            source={editingLocation.aiDescription || editingLocation.playerDescription}
            value={editingLocation.imageTags}
            onChange={(t) => handleChange('imageTags', t)}
          />
        </div>
        <TagAutocomplete
          value={editingLocation.imageTags || ''}
          onChange={(t) => handleChange('imageTags', t)}
          placeholder="booru tags, comma separated"
        />
        <GenerateImageButton
          subject={{ name: editingLocation.name || '', description: editingLocation.aiDescription || editingLocation.playerDescription || '', kind: 'location' }}
          cap={IMAGE_CAPS.background}
          onChange={(file) => handleChange('backgroundImage', file)}
          tags={editingLocation.imageTags ?? ''}
          onTagsChange={(t) => handleChange('imageTags', t)}
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
