import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { KeywordChips } from "@/components/KeywordChips";
import { HelpButton } from "@/components/HelpButton";
import AiFieldToolbar from "@/components/AiFieldToolbar";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { ModelUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { ENTITY_EMBEDDED_IMAGE_LIMIT, entityImages } from '../lib/entityImages';
import ImageTagsField from './ImageTagsField';
import type { Entity, Placeholder } from '@/types';

interface EntityFieldsProps {
  value: Entity;
  onChange: (field: string, value: unknown) => void;
  /** The world's placeholders (World Editor only — a library character has no world to draw them from). */
  placeholders?: Placeholder[];
  /** When provided, renders the Locations picker (World Editor only — a library character has no world locations). */
  locationOptions?: { label: string; value: string }[];
  selectedLocationIds?: string[];
  onLocationsChange?: (ids: string[]) => void;
}

/**
 * The editable-field body for one entity, shared by the World Editor's `EntityManager` (locations picker on,
 * bound to the world store) and the library `EntityEditorModal` (locations hidden, bound to isolated state).
 */
const EntityFields = ({ value, onChange, placeholders = [], locationOptions, selectedLocationIds, onLocationsChange }: EntityFieldsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={value.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Aliases</Label>
          <HelpButton topicId="worldEditor.aliases" className="h-6 w-6" />
        </div>
        <KeywordChips
          keywords={value.aliases ?? []}
          onChange={(aliases) => onChange('aliases', aliases)}
          placeholder="e.g. Liz — press Enter for each"
        />
        <p className="text-sm text-muted-foreground">
          Other names this entity is called — detected in narration and shared with the AI. Case-sensitive.
          Press Enter after each one; an alias may contain commas.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Player-Facing Description</Label>
        <PlaceholderField
          value={value.playerDescription || ''}
          onChange={(v) => onChange('playerDescription', v)}
          placeholders={placeholders}
          resizable
        />
      </div>
      <div className="space-y-2">
        <Label>AI-Facing Description</Label>
        <PlaceholderField
          value={value.aiDescription || ''}
          onChange={(v) => onChange('aiDescription', v)}
          placeholders={placeholders}
          resizable
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>AI-Facing Summary</Label>
          <AiFieldToolbar
            mode="summary"
            source={value.aiDescription}
            value={value.aiSummary}
            onChange={(s) => onChange('aiSummary', s)}
          />
        </div>
        <PlaceholderField
          value={value.aiSummary || ''}
          onChange={(v) => onChange('aiSummary', v)}
          placeholders={placeholders}
          resizable
        />
        <p className="text-sm text-muted-foreground">
          A one-line version used where the full description is too long — keep it brief.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Input
          value={value.type || ''}
          onChange={(e) => onChange('type', e.target.value)}
          placeholder="Enter entity type"
        />
      </div>
      {locationOptions && (
        <div className="space-y-2">
          <Label>Locations</Label>
          <MultiSelect
            key={value.id}
            options={locationOptions}
            defaultValue={selectedLocationIds}
            onValueChange={(ids) => onLocationsChange?.(ids)}
            placeholder="Select locations"
            hideSelectAll
          />
        </div>
      )}
      <ImageTagsField
        label="Image"
        images={entityImages(value)}
        onImagesChange={(list) => onChange('images', list)}
        slots={Infinity}
        embeddedLimit={ENTITY_EMBEDDED_IMAGE_LIMIT}
        imageId={`entity-image-${value.id}`}
        cap={IMAGE_CAPS.entity}
        description={value.aiDescription || value.playerDescription}
        kind="character"
        tags={value.imageTags}
        onTagsChange={(t) => onChange('imageTags', t)}
      />
      <div className="space-y-2">
        <Label>3D Model</Label>
        <ModelUpload
          model={value.model}
          onModelChange={(model) => onChange('model', model)}
          uniqueId={`entity-${value.id}`}
        />
      </div>
    </div>
  );
};

export default EntityFields;
