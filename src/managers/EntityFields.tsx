import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { KeywordChips } from "@/components/KeywordChips";
import { HelpButton } from "@/components/HelpButton";
import AiGenerateButton from "@/components/AiGenerateButton";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { ModelUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { ENTITY_EMBEDDED_IMAGE_LIMIT, entityImages } from '../lib/entityImages';
import ImageTagsField from './ImageTagsField';
import { useEditorMode } from '@/lib/editorMode';
import type { Entity, Placeholder } from '@/types';

/** What every entity field group needs: the entity, a field writer, and the chip vocabulary to offer. */
export interface EntityFieldGroupProps {
  value: Entity;
  onChange: (field: string, value: unknown) => void;
  /** The world's placeholders (World Editor only — a library character has no world to draw them from). */
  placeholders?: Placeholder[];
  /** The entity, as the owner of these fields: its own scoped placeholders read bare here and come first
   *  in every insert menu (World Editor only — a library character owns everything it carries). */
  ownerId?: string;
}

/** Name, Aliases, and Type: who the entity is. Aliases and Type are Advanced only. */
export const EntityIdentityFields = ({ value, onChange, placeholders = [], ownerId }: EntityFieldGroupProps) => {
  const { advanced } = useEditorMode();
  return (
    <>
      <div className="space-y-2">
        <Label>Name</Label>
        <PlaceholderNameField
          value={value.name || ''}
          onChange={(v) => onChange('name', v)}
          placeholders={placeholders}
          ownerId={ownerId}
          ariaLabel="Name"
        />
      </div>
      {advanced && (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Aliases</Label>
          <HelpButton topicId="worldEditor.aliases" className="h-6 w-6" />
        </div>
        <KeywordChips
          keywords={value.aliases ?? []}
          onChange={(aliases) => onChange('aliases', aliases)}
          placeholders={placeholders}
          ownerId={ownerId}
          placeholder="press Enter after each · case-sensitive"
        />
      </div>
      )}
      {advanced && (
        <div className="space-y-2">
          <Label>Type</Label>
          <Input
            value={value.type || ''}
            onChange={(e) => onChange('type', e.target.value)}
            placeholder="Enter entity type"
          />
        </div>
      )}
    </>
  );
};

/** The three prose fields with their AI-generate controls. The summary is Advanced only. */
export const EntityDescriptionFields = ({ value, onChange, placeholders = [], ownerId }: EntityFieldGroupProps) => {
  const { advanced } = useEditorMode();
  return (
    <>
      <PlaceholderField
        label="Player-Facing Description"
        labelAside={(
          <AiGenerateButton
            mode="playerDesc"
            source={value.aiDescription}
            onChange={(s) => onChange('playerDescription', s)}
            kind="character"
          />
        )}
        value={value.playerDescription || ''}
        onChange={(v) => onChange('playerDescription', v)}
        placeholders={placeholders}
        ownerId={ownerId}
        resizable
      />
      <PlaceholderField
        label="AI-Facing Description"
        labelAside={(
          <AiGenerateButton
            mode="aiDesc"
            source={value.playerDescription}
            onChange={(s) => onChange('aiDescription', s)}
            kind="character"
          />
        )}
        value={value.aiDescription || ''}
        onChange={(v) => onChange('aiDescription', v)}
        placeholders={placeholders}
        ownerId={ownerId}
        resizable
      />
      {advanced && (
      <div className="space-y-2">
        <PlaceholderField
          label="AI-Facing Summary"
          labelAside={(
            <AiGenerateButton
              mode="summary"
              source={value.aiDescription}
              onChange={(s) => onChange('aiSummary', s)}
            />
          )}
          value={value.aiSummary || ''}
          onChange={(v) => onChange('aiSummary', v)}
          placeholders={placeholders}
          ownerId={ownerId}
          resizable
        />
        <p className="text-helper text-muted-foreground">
          A one-line version used where the full description is too long — keep it brief.
        </p>
      </div>
      )}
    </>
  );
};

/** The locations the entity belongs to. World Editor only: a library character has no world locations. */
export const EntityLocationsField = ({ value, options, selectedIds, onLocationsChange }: {
  value: Entity;
  options: { label: string; value: string; depth?: number }[];
  selectedIds?: string[];
  onLocationsChange?: (ids: string[]) => void;
}) => (
  <div className="space-y-2">
    <Label>Locations</Label>
    <MultiSelect
      key={value.id}
      options={options}
      defaultValue={selectedIds}
      onValueChange={(ids) => onLocationsChange?.(ids)}
      placeholder="Select locations"
      hideSelectAll
    />
  </div>
);

/** The picture gallery with its tags and generate controls. */
export const EntityGalleryField = ({ value, onChange, placeholders = [], ownerId }: EntityFieldGroupProps) => (
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
    placeholders={placeholders}
    ownerId={ownerId}
  />
);

/** The 3D model slot. Advanced only. */
export const EntityModelField = ({ value, onChange }: Pick<EntityFieldGroupProps, 'value' | 'onChange'>) => {
  const { advanced } = useEditorMode();
  if (!advanced) return null;
  return (
    <div className="space-y-2">
      <Label>3D Model</Label>
      <ModelUpload
        model={value.model}
        onModelChange={(model) => onChange('model', model)}
        uniqueId={`entity-${value.id}`}
      />
    </div>
  );
};

/**
 * The library `EntityEditorModal`'s stacked entity body: the same field groups the World Editor composes,
 * in one column and without the locations picker, bound to isolated state rather than the world store.
 */
const EntityFields = (props: EntityFieldGroupProps) => (
  <div className="space-y-4">
    <EntityIdentityFields {...props} />
    <EntityDescriptionFields {...props} />
    <EntityGalleryField {...props} />
    <EntityModelField value={props.value} onChange={props.onChange} />
  </div>
);

export default EntityFields;
