import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import AiFieldToolbar from "@/components/AiFieldToolbar";
import { TagAutocomplete } from "@/components/TagAutocomplete";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PlaceholderField from "@/components/prompt/PlaceholderField";
import { ImageUpload, ModelUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { GenerateImageButton } from '../components/GenerateImageButton';
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
  // SD prompt pulled from an uploaded image, pending the user's OK to use it as Image Tags.
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

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
      <div className="space-y-2">
        <Label>Image</Label>
        <ImageUpload
          onChange={(file) => onChange('image', file)}
          id={`entity-image-${value.id}`}
          value={value.image}
          cap={IMAGE_CAPS.entity}
          onPromptExtracted={setPendingPrompt}
        />
        <ConfirmDialog
          open={pendingPrompt !== null}
          onOpenChange={(o) => { if (!o) setPendingPrompt(null); }}
          title="Use the image's prompt?"
          description="This image has an embedded AI prompt. Use it as the Image Tags? This replaces the current tags."
          onConfirm={() => { if (pendingPrompt) onChange('imageTags', pendingPrompt); }}
          onCancel={() => setPendingPrompt(null)}
        />
        <div className="flex items-center justify-between">
          <Label>Image Tags</Label>
          <AiFieldToolbar
            mode="tags"
            name={value.name}
            kind="character"
            source={value.aiDescription || value.playerDescription}
            value={value.imageTags}
            onChange={(t) => onChange('imageTags', t)}
          />
        </div>
        <TagAutocomplete
          value={value.imageTags || ''}
          onChange={(t) => onChange('imageTags', t)}
          placeholder="booru tags, comma separated"
        />
        <GenerateImageButton
          subject={{ name: value.name || '', description: value.aiDescription || value.playerDescription || '', kind: 'character' }}
          cap={IMAGE_CAPS.entity}
          onChange={(file) => onChange('image', file)}
          tags={value.imageTags ?? ''}
          onTagsChange={(t) => onChange('imageTags', t)}
        />
      </div>
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
