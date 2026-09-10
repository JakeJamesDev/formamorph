import { useEffect } from 'react';
import { useEditingDraft } from '@/lib/useEditingDraft';
import { useGameData } from '@/contexts/GameDataContext';
import { entitiesInTreeOrder } from '@/lib/entityGroupTree';
import { entityIdsAt, setLocationRoster } from '@/lib/entityPresence';
import { Label } from "@/components/ui/label";
import { Hint } from "@/components/ui/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PanelTabsList } from '@/components/ui/panel-tabs';
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
import { locationPanelTabsFor, locationTabForField, type LocationPanelTab } from '@/views/locationPanelTabs';
import type { FocusFieldHint, GameLocation, PlaceholderPin } from '@/types';

/**
 * Right-panel editor for one location: its fields split across Details, Presence, Media and Pins.
 *
 * The panel remounts per location, so the chosen tab is the editor's to hold and arrives as a prop. The
 * background image sits on Media rather than beside the name: a location has one slot and it is a backdrop,
 * so it does not earn a column the way an entity's portrait does.
 *
 * `focusField` is the search target the find bar just navigated to. A hit on a tab that isn't showing has no
 * field to mark, so the panel opens the owning tab; the same hint the entity and Overview panels take.
 */
const LocationManager = ({ location, tab, onTabChange, focusField }: {
  location: GameLocation;
  tab: LocationPanelTab;
  onTabChange: (tab: LocationPanelTab) => void;
  focusField?: FocusFieldHint | null;
}) => {
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

  // Before the reveal, which is a timer behind this render: the field it looks for has to be mounting by
  // then. A key no tab claims leaves the panel where the author put it.
  useEffect(() => {
    const owning = focusField ? locationTabForField(focusField.fieldKey) : null;
    if (owning) onTabChange(owning);
  }, [focusField, onTabChange]);

  if (!editingLocation) return null;

  const tabs = locationPanelTabsFor(advanced);

  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as LocationPanelTab)} className="space-y-4">
      <PanelTabsList tabs={tabs} stripLabel="Location Fields" />

      <TabsContent value="details" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Name</Label>
            <PlaceholderNameField
              value={editingLocation.name || ''}
              onChange={(v) => handleChange('name', v)}
              placeholders={placeholders}
              ariaLabel="Name"
            />
          </div>
          {/* Bottom-aligned and as tall as the field, so the checkbox sits on the name's last line when a
              long name wraps. */}
          <div className="flex min-h-10 shrink-0 items-center gap-2">
            <Checkbox
              id={`location-starting-${editingLocation.id}`}
              checked={!!editingLocation.isStarting}
              onCheckedChange={(checked) => handleChange('isStarting', !!checked)}
            />
            <Label htmlFor={`location-starting-${editingLocation.id}`}>
              Starting location (new games may begin here)
            </Label>
          </div>
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
          <Hint>A one-line version for where the full description is too long. Keep it brief.</Hint>
        </div>
        )}
      </TabsContent>

      <TabsContent value="presence" className="space-y-4">
        <div className="space-y-2">
          <Label>Entities</Label>
          <MultiSelect
            key={editingLocation.id}
            options={entitiesInTreeOrder(entityGroups, entities).map((e) => ({ label: labelPlaceholders(e.name, placeholders, { letters: placementLetters, owners: placeholderOwners }), value: e.id }))}
            defaultValue={presentIds}
            onValueChange={handleEntitiesChange}
            placeholder="Select entities"
            hideSelectAll
          />
        </div>
        <LocationConnections location={editingLocation} />
      </TabsContent>

      <TabsContent value="media" className="space-y-4">
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
      </TabsContent>

      {advanced && (
        <TabsContent value="pins" className="space-y-2">
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
        </TabsContent>
      )}
    </Tabs>
  );
};

export default LocationManager;
