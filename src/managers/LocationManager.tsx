import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameData } from '@/contexts/GameDataContext';
import { entitiesInTreeOrder } from '@/lib/entityGroupTree';
import { entityIdsAt, setLocationRoster } from '@/lib/entityPresence';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import AiGenerateButton from "@/components/AiGenerateButton";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { labelPlaceholders } from '@/lib/placementLetters';
import { SoundUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import ImageTagsField from './ImageTagsField';
import LocationConnections from './LocationConnections';
import { useEditorMode } from '@/lib/editorMode';
import { HelpButton } from '@/components/HelpButton';
import { PlaceholderPinRows } from '@/components/editor/PlaceholderPinRows';
import type { GameLocation, PlaceholderPin } from '@/types';

const LocationManager = ({ location }: { location: GameLocation }) => {
  const world = useGameData();
  const { updateLocation, entities, updateEntity, entityGroups, placeholders, placementLetters, placeholderOwners } = world;
  const { draft: editingLocation, setField: handleChange, apply } = useEditingDraft(location, updateLocation);
  const { advanced } = useEditorMode();
  const pins = editingLocation?.placeholderPins ?? [];
  const setPins = (next: PlaceholderPin[]) => apply({ placeholderPins: next.length ? next : undefined });

  // Membership is entity-owned, so location-first authoring reads the inversion and writes each changed
  // entity's own list — the same edit, expressed from the other side.
  const presentIds = entityIdsAt(location.id, entities);
  const handleEntitiesChange = (ids: string[]) => {
    const before = new Map(entities.map((e) => [e.id, e]));
    // Only the entities whose membership actually moved are written through.
    setLocationRoster(location.id, ids, entities).forEach((entity) => {
      if (before.get(entity.id) !== entity) updateEntity(entity);
    });
  };

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
          options={entitiesInTreeOrder(entityGroups, entities).map((e) => ({ label: labelPlaceholders(e.name, placeholders, placementLetters, placeholderOwners), value: e.id }))}
          defaultValue={presentIds}
          onValueChange={handleEntitiesChange}
          placeholder="Select entities"
          hideSelectAll
        />
      </div>
      <LocationConnections location={editingLocation} />
      {advanced && (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Placeholder Pins</Label>
          <HelpButton topicId="worldEditor.locationPins" className="h-6 w-6" />
        </div>
        <PlaceholderPinRows
          pins={pins}
          onChange={setPins}
          source={{ kind: 'location', id: editingLocation.id }}
          world={world}
          placeholders={placeholders}
        />
      </div>
      )}
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
