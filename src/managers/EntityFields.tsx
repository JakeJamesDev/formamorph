import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint } from "@/components/ui/typography";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeywordChips } from "@/components/KeywordChips";
import { HelpButton } from "@/components/HelpButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PlaceholderText from "@/components/prompt/PlaceholderText";
import AiGenerateButton from "@/components/AiGenerateButton";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { ModelUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { entityImages } from '../lib/entityImages';
import { ImageGallery, ImageTags, ImageWidget } from './ImageTagsField';
import { useEditorMode } from '@/lib/editorMode';
import { labelPlaceholders } from '@/lib/placementLetters';
import { customPersonaCounts, personaRole, personaRolePatch, unmarkLine, type PersonaRole } from '@/lib/customPersona';
import type { RenameFieldHandlers } from '@/lib/useCodeRename';
import type { ReactNode } from 'react';
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

/** Identity fields, with Advanced-only Aliases, Persona, and Type. */
export const EntityIdentityFields = ({ value, onChange, placeholders = [], ownerId, nameHandlers, home, customPersonaHolder }: EntityFieldGroupProps & {
  home: EntityHome;
  /** See {@link EntityPersonaField}. */
  customPersonaHolder?: string;
  /** What reports a committed rename of this entity, so the code that reaches its placeholders by path can
   *  follow. Absent outside the World Editor, where there is no world code to rewrite. */
  nameHandlers?: RenameFieldHandlers;
}) => {
  const { advanced } = useEditorMode();
  return (
    <>
      <div data-tour-anchor="entity-name" className="space-y-2">
        <Label>Name</Label>
        <PlaceholderNameField
          value={value.name || ''}
          onChange={(v) => onChange('name', v)}
          placeholders={placeholders}
          ownerId={ownerId}
          ariaLabel="Name"
          {...nameHandlers}
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
          placeholder="Press Enter after each alias"
        />
      </div>
      )}
      <div data-tour-anchor="entity-pronouns" className="space-y-2">
        <Label htmlFor={`entity-pronouns-${value.id}`}>Pronouns</Label>
        <Hint>Tells the AI how to refer to this entity</Hint>
        <Input
          id={`entity-pronouns-${value.id}`}
          value={value.pronouns || ''}
          onChange={(e) => onChange('pronouns', e.target.value)}
          placeholder="she/her, he/him, it/its"
        />
      </div>
      <EntityPersonaField value={value} onChange={onChange} placeholders={placeholders} home={home} customPersonaHolder={customPersonaHolder} />
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

/** Where an entity lives, which decides what its Persona mark means. */
export type EntityHome = 'world' | 'library';

const PERSONA_ROLES: Record<EntityHome, { value: PersonaRole; label: string; hint: string }[]> = {
  world: [
    { value: 'cast', label: 'Cast', hint: 'Appears in the world as a regular entity' },
    { value: 'playable', label: 'Playable', hint: 'Lets the player play as this entity, or meet it in the world' },
    { value: 'only', label: 'Persona-Only', hint: 'Appears only when the player picks it as their persona' },
    { value: 'custom', label: 'Custom Persona', hint: 'Becomes the persona the player creates' },
  ],
  library: [
    { value: 'cast', label: 'Cast', hint: 'Joins a world as a regular entity' },
    { value: 'playable', label: 'Playable', hint: 'Lets you play as this entity in any world' },
  ],
};

// The world's four go across only once the column clears the widest label on each; two-up below that.
const ROLE_GRID: Record<EntityHome, string> = { world: 'h-auto grid-cols-2 [@container(min-width:32rem)]:grid-cols-4', library: 'grid-cols-2' };

/** The Persona role. Advanced only in the World Editor; the library editor is always Advanced. Leaving the
 *  Custom Persona role asks first when the entity carries links, traits or copies. */
export const EntityPersonaField = ({ value, onChange, placeholders = [], home, customPersonaHolder }: EntityFieldGroupProps & {
  home: EntityHome;
  /** The name of another entity holding the Custom Persona mark, which keeps the role off this one. */
  customPersonaHolder?: string;
}) => {
  const { advanced } = useEditorMode();
  const [pending, setPending] = useState<{ role: PersonaRole; line: string } | null>(null);
  if (!advanced) return null;
  const roles = PERSONA_ROLES[home];
  const role = personaRole(value);
  const apply = (next: PersonaRole) => {
    for (const [field, v] of Object.entries(personaRolePatch(next))) onChange(field, v);
  };
  const pick = (next: PersonaRole) => {
    const line = role === 'custom' ? unmarkLine(customPersonaCounts(value)) : null;
    if (line) setPending({ role: next, line });
    else apply(next);
  };
  return (
    <div className="space-y-2 [container-type:inline-size]">
      <Label id={`entity-persona-${value.id}`}>Persona</Label>
      <ToggleGroup
        type="single"
        value={role}
        aria-labelledby={`entity-persona-${value.id}`}
        // A single ToggleGroup clears its value when the active item is clicked again; a role is always set.
        onValueChange={(v) => { if (v) pick(v as PersonaRole); }}
        className={`grid w-full ${ROLE_GRID[home]}`}
      >
        {roles.map((r) => (
          <ToggleGroupItem key={r.value} value={r.value} disabled={r.value === 'custom' && !!customPersonaHolder}>
            {r.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {/* Hints stacked in one cell so switching roles doesn't reflow the layout. */}
      <div className="grid">
        {roles.map((r) => (
          <Hint key={r.value} className={`col-start-1 row-start-1${r.value === role ? '' : ' invisible'}`}>{r.hint}</Hint>
        ))}
      </div>
      {customPersonaHolder && (
        <Hint>
          Only one entity can be the Custom Persona.{' '}
          <strong><PlaceholderText text={customPersonaHolder} placeholders={placeholders} /></strong> has it now.
        </Hint>
      )}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={`Remove the Custom Persona Role from ${labelPlaceholders(value.name, placeholders)}?`}
        description={pending?.line}
        onConfirm={() => {
          if (pending) apply(pending.role);
          setPending(null);
        }}
      />
    </div>
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
        ownerName={value.name}
        resizable
        tourAnchor="entity-player-description"
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
        ownerName={value.name}
        resizable
        tourAnchor="entity-ai-description"
      />
      {advanced && (
        <PlaceholderField
          label="AI-Facing Summary"
          labelAside={(
            <AiGenerateButton
              mode="summary"
              source={value.aiDescription}
              onChange={(s) => onChange('aiSummary', s)}
            />
          )}
          hint="Replaces the full description in prompt slots too small for it. Keep it brief."
          value={value.aiSummary || ''}
          onChange={(v) => onChange('aiSummary', v)}
          placeholders={placeholders}
          ownerId={ownerId}
          ownerName={value.name}
          resizable
        />
      )}
    </>
  );
};

/** The world's locations to pick from, and the entity's own membership in them. */
export interface EntityLocationsFieldProps extends EntityFieldGroupProps {
  options: MultiSelectOption[];
  selectedIds?: string[];
  onLocationsChange?: (ids: string[]) => void;
}

/** The locations the entity belongs to. World Editor only: a library character has no world locations. */
export const EntityLocationsField = ({ value, options, selectedIds, onLocationsChange }: EntityLocationsFieldProps) => (
  <div data-tour-anchor="entity-locations" className="space-y-2">
    <Label>Locations</Label>
    <MultiSelect
      key={value.id}
      options={options}
      defaultValue={selectedIds}
      onValueChange={(ids) => onLocationsChange?.(ids)}
      placeholder="Select locations"
    />
  </div>
);

const AUTOMATIC = 'automatic';

/** Where a world persona begins: Automatic, then every location. Shows only while the Persona mark is on. */
export const EntityStartingLocationField = ({ value, onChange, options }: EntityFieldGroupProps & {
  options: MultiSelectOption[];
}) => {
  const { advanced } = useEditorMode();
  if (!advanced || value.persona !== true) return null;
  const selected = options.some((o) => o.value === value.startingLocationId) ? value.startingLocationId! : AUTOMATIC;
  return (
    <div className="space-y-2">
      <Label htmlFor={`entity-start-${value.id}`}>Starting Location</Label>
      <Hint>Selects where the player starts as this persona</Hint>
      <Select value={selected} onValueChange={(v) => onChange('startingLocationId', v === AUTOMATIC ? undefined : v)}>
        <SelectTrigger id={`entity-start-${value.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTOMATIC}>Automatic</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};

/**
 * The entity's picture widget with neither piece placed: a host draws `ImageGallery` and `ImageTags` where
 * its own layout wants them and both still write this entity. `EntityGalleryField` is the one-box version.
 */
export const EntityImageWidget = ({ value, onChange, placeholders = [], ownerId, children }: EntityFieldGroupProps & { children: ReactNode }) => (
  <ImageWidget
    label="Image"
    tourAnchor="entity-image"
    images={entityImages(value)}
    onImagesChange={(list) => onChange('images', list)}
    slots={Infinity}
    imageId={`entity-image-${value.id}`}
    cap={IMAGE_CAPS.entity}
    description={value.aiDescription || value.playerDescription}
    kind="character"
    tags={value.imageTags}
    onTagsChange={(t) => onChange('imageTags', t)}
    placeholders={placeholders}
    ownerId={ownerId}
  >
    {children}
  </ImageWidget>
);

/** The picture gallery with its tags and generate controls, in one box. */
export const EntityGalleryField = (props: EntityFieldGroupProps) => (
  <EntityImageWidget {...props}>
    <ImageGallery tagsSlot={<ImageTags />} />
  </EntityImageWidget>
);

/** The 3D model slot. Advanced only. */
export const EntityModelField = ({ value, onChange }: EntityFieldGroupProps) => {
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
 * The Profile tab of both entity editors: the picture and its tags in one grid with the identity fields and
 * the Persona mark, then `locations` (World Editor only) and the model. `columnsClassName` sets when the grid splits into
 * two columns, since each host's pane widens differently.
 */
export const EntityProfileFields = ({ columnsClassName, nameHandlers, locations, home, customPersonaHolder, ...props }: EntityFieldGroupProps & {
  columnsClassName: string;
  nameHandlers?: RenameFieldHandlers;
  locations?: ReactNode;
  home: EntityHome;
  /** See {@link EntityPersonaField}. */
  customPersonaHolder?: string;
}) => (
  <>
    <EntityImageWidget {...props}>
      <div className={`grid gap-4 ${columnsClassName}`}>
        <ImageGallery />
        <div className="space-y-4">
          <EntityIdentityFields {...props} nameHandlers={nameHandlers} home={home} customPersonaHolder={customPersonaHolder} />
          <ImageTags />
        </div>
      </div>
    </EntityImageWidget>
    {locations}
    <EntityModelField {...props} />
  </>
);
