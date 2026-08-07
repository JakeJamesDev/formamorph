import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameData } from '@/contexts/GameDataContext';
import { entitiesInTreeOrder } from '@/lib/entityGroupTree';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import AiFieldToolbar from "@/components/AiFieldToolbar";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { labelPlaceholders } from '@/lib/placeholders';
import { SoundUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';
import type { GameLocation } from '@/types';

const LocationManager = ({ location }: { location: GameLocation }) => {
  const { updateLocation, entities, entityGroups, placeholders } = useGameData();
  const { draft: editingLocation, setField: handleChange } = useEditingDraft(location, updateLocation);

  if (!editingLocation) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <PlaceholderNameField
          value={editingLocation.name || ''}
          onChange={(v) => handleChange('name', v)}
          placeholders={placeholders}
          ariaLabel="Name"
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
          resizable
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <PlaceholderField
          value={editingLocation.aiDescription || ''}
          onChange={(v) => handleChange('aiDescription', v)}
          placeholders={placeholders}
          resizable
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
          resizable
        />
        <p className="text-sm text-muted-foreground">
          A one-line version used where the full description is too long — keep it brief.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Entities</Label>
        <MultiSelect
          key={editingLocation.id}
          options={entitiesInTreeOrder(entityGroups, entities).map((e) => ({ label: labelPlaceholders(e.name, placeholders), value: e.id }))}
          defaultValue={editingLocation.entities ?? []}
          onValueChange={(v) => handleChange('entities', v)}
          placeholder="Select entities"
          hideSelectAll
        />
      </div>
      <ImageTagsField
        label="Background Image"
        images={editingLocation.backgroundImage ? [editingLocation.backgroundImage] : []}
        onImagesChange={(list) => handleChange('backgroundImage', list[0] ?? '')}
        imageId={`location-image-${editingLocation.id}`}
        cap={IMAGE_CAPS.background}
        description={editingLocation.aiDescription || editingLocation.playerDescription}
        kind="location"
        tags={editingLocation.imageTags}
        onTagsChange={(t) => handleChange('imageTags', t)}
      />
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
