import { useEffect, useState } from "react";
import { useEntityRuleHost } from '@/components/editor/ImageRuleCog';
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint } from "@/components/ui/typography";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { KeywordChips } from "@/components/KeywordChips";
import { HelpButton } from "@/components/HelpButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PlaceholderText from "@/components/prompt/PlaceholderText";
import AiGenerateButton from "@/components/AiGenerateButton";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { ModelUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { entityImages } from '../lib/entityImages';
import { ImageGallery, ImageTags, ImageWidget, type GalleryFrameProps } from './ImageTagsField';
import { useEditorMode } from '@/lib/editorMode';
import { labelPlaceholders } from '@/lib/placementLetters';
import { customPersonaCounts, personaRole, personaRolePatch, unmarkLine, type PersonaRole } from '@/lib/customPersona';
import type { RenameFieldHandlers } from '@/lib/useCodeRename';
import type { ReactNode } from 'react';
import type { Entity, Placeholder, VrmPick } from '@/types';
import { vrmPickFromValue, vrmPickValue } from '@/lib/worldVrmStore';
import { pickLabel } from '@/lib/vrmPickMatch';
import { WorldInput } from '@/components/editor/WorldField';
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectOptions } from "@/components/SelectOptions";
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useWorldHistoryStep } from '@/contexts/worldRecorder';
import { fieldFrame } from '@/lib/historyField';
import { useMountedRef } from '@/lib/useMountedRef';
import ModelStorageService from '@/services/ModelStorageService';

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
export const EntityIdentityFields = ({ value, onChange, placeholders = [], ownerId, nameHandlers, home, customPersonaEntityName }: EntityFieldGroupProps & {
  home: EntityHome;
  /** See {@link EntityPersonaField}. */
  customPersonaEntityName?: string;
  /** What reports a committed rename of this entity, so the code that reaches its placeholders by path can
   *  follow. Absent outside the World Editor, where there is no world code to rewrite. */
  nameHandlers?: RenameFieldHandlers;
}) => {
  const { advanced } = useEditorMode();
  return (
    <>
      <div data-tour-anchor="entity-name" className="space-y-2" {...fieldFrame('name')}>
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
      <div className="space-y-2" {...fieldFrame('aliases')}>
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
      <div data-tour-anchor="entity-pronouns" className="space-y-2" {...fieldFrame('pronouns')}>
        <Label>Pronouns</Label>
        <Hint>Tells the AI how to refer to this entity</Hint>
        <PlaceholderNameField
          value={value.pronouns || ''}
          onChange={(v) => onChange('pronouns', v)}
          placeholders={placeholders}
          ownerId={ownerId}
          ariaLabel="Pronouns"
          placeholder="she/her, he/him, it/its"
        />
      </div>
      <EntityPersonaField value={value} onChange={onChange} placeholders={placeholders} home={home} customPersonaEntityName={customPersonaEntityName} />
      {advanced && (
        <div className="space-y-2" {...fieldFrame('type')}>
          <Label>Type</Label>
          <WorldInput
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

/** Run an entity edit; when it leaves the Custom Persona with a pick, drop the legacy fallback in the same Step. */
const useSpendFallback = () => {
  const gameData = useGameDataOptional();
  const asStep = useWorldHistoryStep();
  return (label: string, customPersonaPicks: boolean, run: () => void) => {
    if (!customPersonaPicks || !gameData?.worldOverview.legacyVrmFallback) return run();
    asStep(label, () => { run(); gameData.updateWorldOverview({ legacyVrmFallback: undefined }); });
  };
};

// The world's four go across only once the column clears the widest label on each; two-up below that.
const ROLE_GRID: Record<EntityHome, string> = { world: 'h-auto grid-cols-2 [@container(min-width:32rem)]:grid-cols-4', library: 'grid-cols-2' };

/** The Persona role. Advanced only in the World Editor; the library editor is always Advanced. Leaving the
 *  Custom Persona role asks first when the entity carries links, traits or copies. */
export const EntityPersonaField = ({ value, onChange, placeholders = [], home, customPersonaEntityName }: EntityFieldGroupProps & {
  home: EntityHome;
  /** The name of another entity holding the Custom Persona mark, which keeps the role off this one. */
  customPersonaEntityName?: string;
}) => {
  const { advanced } = useEditorMode();
  const spendFallback = useSpendFallback();
  const [pending, setPending] = useState<{ role: PersonaRole; line: string } | null>(null);
  if (!advanced) return null;
  const roles = PERSONA_ROLES[home];
  const role = personaRole(value);
  const apply = (next: PersonaRole) => spendFallback('Set Persona', next === 'custom' && !!value.vrmPick, () => {
    for (const [field, v] of Object.entries(personaRolePatch(next))) onChange(field, v);
  });
  const pick = (next: PersonaRole) => {
    const line = role === 'custom' ? unmarkLine(customPersonaCounts(value)) : null;
    if (line) setPending({ role: next, line });
    else apply(next);
  };
  return (
    <div className="space-y-2 [container-type:inline-size]" {...fieldFrame('persona')}>
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
          <ToggleGroupItem key={r.value} value={r.value} disabled={r.value === 'custom' && !!customPersonaEntityName}>
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
      {customPersonaEntityName && (
        <Hint>
          Only one entity can be the Custom Persona.{' '}
          <strong><PlaceholderText text={customPersonaEntityName} placeholders={placeholders} /></strong> has it now.
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
        historyField="playerDescription"
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
        historyField="aiDescription"
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
          historyField="aiSummary"
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

/** The locations the entity belongs to, and where the player can start as it under the Persona mark. World
 *  Editor only: a library character has no world locations. */
export const EntityLocationsField = ({ value, options, selectedIds, onLocationsChange }: EntityLocationsFieldProps) => (
  <div data-tour-anchor="entity-locations" className="space-y-2" {...fieldFrame('locations')}>
    <Label>Locations</Label>
    {value.persona === true && <Hint>The player can start as this persona at any of these</Hint>}
    <MultiSelect
      key={value.id}
      options={options}
      defaultValue={selectedIds}
      onValueChange={(ids) => onLocationsChange?.(ids)}
      placeholder="Select locations"
    />
  </div>
);

/**
 * The entity's picture widget with neither piece placed: a host draws `ImageGallery` and `ImageTags` where
 * its own layout wants them and both still write this entity. `EntityGalleryField` is the one-box version.
 */
export const EntityImageWidget = ({ value, onChange, placeholders = [], ownerId, children, frame, imageId = `entity-image-${value.id}` }: EntityFieldGroupProps & {
  children: ReactNode;
  /** A host that shows the framed image's details controls the frame. */
  frame?: GalleryFrameProps;
  /** The file inputs' id, unique per rendered widget. */
  imageId?: string;
}) => {
  const ruleHost = useEntityRuleHost(value.id);
  return (
    <ImageWidget
      label="Image"
      tourAnchor="entity-image"
      images={entityImages(value)}
      onImagesChange={(list) => onChange('images', list)}
      slots={Infinity}
      imageId={imageId}
      cap={IMAGE_CAPS.entity}
      description={value.aiDescription || value.playerDescription}
      kind="character"
      fileSubject={labelPlaceholders(value.name, placeholders)}
      tags={value.imageTags}
      onTagsChange={(t) => onChange('imageTags', t)}
      placeholders={placeholders}
      ownerId={ownerId}
      ruleHost={ruleHost}
      {...frame}
    >
      {children}
    </ImageWidget>
  );
};

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

/** The Avatar dropdown both entity editors share. None and User's Default lead, `named` follows, and a stored
 *  pick that matches no option reads as None. */
const AvatarPickField = ({ entityId, hint, named, stored, onPick }: {
  entityId: string;
  hint: string;
  /** The editor's own Avatars, as option values from `vrmPickValue`. */
  named: { value: string; label: string }[];
  stored: string;
  onPick: (pick: VrmPick | undefined) => void;
}) => {
  const none = vrmPickValue(undefined);
  const options = [
    { value: none, label: 'None' },
    { value: vrmPickValue({ kind: 'default' }), label: "User's Default" },
    ...named,
  ];
  const selected = options.some((o) => o.value === stored) ? stored : none;
  return (
    <div className="space-y-2" {...fieldFrame('vrmPick')}>
      <Label htmlFor={`entity-vrm-${entityId}`}>Avatar</Label>
      <Hint>{hint}</Hint>
      <Select value={selected} onValueChange={(v) => onPick(vrmPickFromValue(v))}>
        <SelectTrigger id={`entity-vrm-${entityId}`} className="w-64 max-w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectOptions options={options} />
        </SelectContent>
      </Select>
    </div>
  );
};

export const ENTITY_VRM_HINT = 'Picks the Avatar this entity shows. Add Avatars in the Media tab.';

/** The entity's Avatar: none, the player's default, or one of the world's. World Editor and Advanced only. */
export const EntityVrmPickField = ({ value, onChange }: EntityFieldGroupProps) => {
  const { advanced } = useEditorMode();
  const spendFallback = useSpendFallback();
  const store = useGameDataOptional()?.worldOverview?.vrmStore;
  if (!advanced) return null;
  const pick = (next: VrmPick | undefined) =>
    spendFallback('Set Avatar', !!next && !!value.customPersona, () => onChange('vrmPick', next));
  const named = Object.entries(store ?? {}).map(([id, vrm]) => ({ value: vrmPickValue({ kind: 'world', id }), label: vrm.name || 'Unnamed' }));
  return <AvatarPickField entityId={value.id} hint={ENTITY_VRM_HINT} named={named} stored={vrmPickValue(value.vrmPick)} onPick={pick} />;
};

export const LIBRARY_ENTITY_VRM_HINT = 'Picks the Avatar this entity shows. Add Avatars on the Avatars tab.';

/** A library entity's Avatar: none, the player's default, or one from the player's Avatar library. */
export const LibraryEntityVrmPickField = ({ value, onChange }: EntityFieldGroupProps) => {
  const [library, setLibrary] = useState<{ id: string; name: string }[] | undefined>();
  const mounted = useMountedRef();
  useEffect(() => {
    ModelStorageService.getModelMetadata()
      .then((models) => { if (mounted.current) setLibrary(models); })
      .catch(() => { /* An unreadable library offers None and User's Default only. */ });
  }, [mounted]);
  const named = (library ?? []).map((model) => ({ value: vrmPickValue({ kind: 'library', id: model.id }), label: model.name || 'Unnamed' }));
  const stored = vrmPickValue(value.vrmPick);
  // Once the library is read, a library id it lacks keeps its own option, named as the link review names it.
  if (library && value.vrmPick?.kind === 'library' && !named.some((o) => o.value === stored)) {
    named.push({ value: stored, label: pickLabel(value.vrmPick, { world: new Map(), library: new Map() }) });
  }
  return <AvatarPickField entityId={value.id} hint={LIBRARY_ENTITY_VRM_HINT} named={named} stored={stored} onPick={(next) => onChange('vrmPick', next)} />;
};

/**
 * The Profile tab of both entity editors: the picture and its tags in one grid with the identity fields and
 * the Persona mark, then `locations` (World Editor only) and the model. `columnsClassName` sets when the grid splits into
 * two columns, since each host's pane widens differently.
 */
export const EntityProfileFields = ({ columnsClassName, nameHandlers, locations, home, customPersonaEntityName, ...props }: EntityFieldGroupProps & {
  columnsClassName: string;
  nameHandlers?: RenameFieldHandlers;
  locations?: ReactNode;
  home: EntityHome;
  /** See {@link EntityPersonaField}. */
  customPersonaEntityName?: string;
}) => (
  <>
    <EntityImageWidget {...props}>
      <div className={`grid gap-4 ${columnsClassName}`}>
        <ImageGallery />
        <div className="space-y-4">
          <EntityIdentityFields {...props} nameHandlers={nameHandlers} home={home} customPersonaEntityName={customPersonaEntityName} />
          <ImageTags />
        </div>
      </div>
    </EntityImageWidget>
    {locations}
    <EntityModelField {...props} />
    {home === 'world' ? <EntityVrmPickField {...props} /> : <LibraryEntityVrmPickField {...props} />}
  </>
);
