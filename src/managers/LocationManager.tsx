import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameData } from '@/contexts/GameDataContext';
import { entitiesInTreeOrder } from '@/lib/entityGroupTree';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import AiGenerateButton from "@/components/AiGenerateButton";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { describePlaceholders } from '@/lib/placeholders';
import { SoundUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';
import { useEditorMode } from '@/lib/editorMode';
import type { GameLocation } from '@/types';

const LocationManager = ({ location }: { location: GameLocation }) => {
  const { updateLocation, entities, entityGroups, placeholders } = useGameData();
  const { draft: editingLocation, setField: handleChange } = useEditingDraft(location, updateLocation);
  const { advanced } = useEditorMode();

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
      <PlaceholderField
        label="Player-Facing Description"
        labelAside={(
          <AiGenerateButton
            mode="playerDesc"
            source={editingLocation.aiDescription}
            onChange={(s) => handleChange('playerDescription', s)}
            kind="location"
          />
        )}
        value={editingLocation.playerDescription || ''}
        onChange={(v) => handleChange('playerDescription', v)}
        placeholders={placeholders}
        resizable
      />
      <PlaceholderField
        label="AI-Facing Description"
        labelAside={(
          <AiGenerateButton
            mode="aiDesc"
            source={editingLocation.playerDescription}
            onChange={(s) => handleChange('aiDescription', s)}
            kind="location"
          />
        )}
        value={editingLocation.aiDescription || ''}
        onChange={(v) => handleChange('aiDescription', v)}
        placeholders={placeholders}
        resizable
      />
      {advanced && (
      <div className="space-y-2">
        <PlaceholderField
          label="AI-Facing Summary"
          labelAside={(
            <AiGenerateButton
              mode="summary"
              source={editingLocation.aiDescription}
              onChange={(s) => handleChange('aiSummary', s)}
            />
          )}
          value={editingLocation.aiSummary || ''}
          onChange={(v) => handleChange('aiSummary', v)}
          placeholders={placeholders}
          resizable
        />
        <p className="text-helper text-muted-foreground">
          A one-line version used where the full description is too long — keep it brief.
        </p>
      </div>
      )}
      <div className="space-y-2">
        <Label>Entities</Label>
        <MultiSelect
          key={editingLocation.id}
          options={entitiesInTreeOrder(entityGroups, entities).map((e) => ({ label: describePlaceholders(e.name, placeholders), value: e.id }))}
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
        placeholders={placeholders}
      />
      {advanced && (
        <div className="space-y-2">
          <Label>Ambient Sound</Label>
          <SoundUpload
            onChange={(file) => handleChange('ambientSound', file)}
            id={`location-sound-${editingLocation.id}`}
            value={editingLocation.ambientSound}
          />
        </div>
      )}
    </div>
  );
};

export default LocationManager;
