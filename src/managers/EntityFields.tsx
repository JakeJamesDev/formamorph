import { useCallback, useEffect, useState } from "react";
import { useEntityRuleHost, type RuleHost } from '@/components/editor/ImageRuleCog';
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint } from "@/components/ui/typography";
import { KeywordChips } from "@/components/KeywordChips";
import { HelpButton } from "@/components/HelpButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import PlaceholderText from "@/components/prompt/PlaceholderText";
import AiGenerateButton from "@/components/AiGenerateButton";
import PlaceholderField, { PlaceholderNameField } from "@/components/prompt/PlaceholderField";
import { ModelUpload } from '../lib/UtilityComponents';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { entityImages, galleryLinks } from '../lib/entityImages';
import { useLinkedGallery } from '@/lib/useLinkedGallery';
import { ImageGallery, ImageTags, ImageWidget, type GalleryFrameProps } from './ImageTagsField';
import type { GalleryMedia } from '@/lib/mediaGallery';
import { useEditorMode } from '@/lib/editorMode';
import { labelPlaceholders } from '@/lib/placementLetters';
import { randomUUID } from '@/lib/uuid';
import { customPersonaCounts, personaRole, personaRolePatch, unmarkLine, withPersonaRole, type PersonaRole } from '@/lib/customPersona';
import type { RenameFieldHandlers } from '@/lib/useCodeRename';
import type { ReactNode } from 'react';
import type { Entity, GalleryImage, GalleryLink, ModelMetadata, Placeholder, VrmPick } from '@/types';
import { useLibraryAddBlock } from '@/lib/useSupporterCopyBlock';
import { vrmPickFromValue, vrmPickValue } from '@/lib/worldVrmStore';
import { pickLabel } from '@/lib/vrmPickMatch';
import { WorldInput } from '@/components/editor/WorldField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QUOTE_SWATCHES, isQuoteSwatch, swatchColor } from '@/lib/coref/speakerPalette';
import { SelectOptions } from "@/components/SelectOptions";
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useWorldHistoryStep } from '@/contexts/worldRecorder';
import { fieldFrame } from '@/lib/historyField';
import { SplitNameField, SplitNameRow } from '@/components/editor/SplitNameRow';
import { useMountedRef } from '@/lib/useMountedRef';
import ModelStorageService from '@/services/ModelStorageService';

/** The fields an entity shares with an item, which the description and image editors read. */
/** The AI-Facing Summary hint, shared by every record with a summary. */
export const AI_SUMMARY_HINT = "Sends the AI this short version where a full description doesn't fit. Keep it brief.";

export type DescribedRecord = Pick<Entity, 'id' | 'name' | 'playerDescription' | 'aiDescription' | 'aiSummary' | 'images' | 'imageTags'>;

/** What a description or image editor needs: the record, a field writer, and the chip vocabulary to offer. */
export interface DescribedFieldGroupProps<T extends DescribedRecord = DescribedRecord> {
  value: T;
  onChange: (field: string, value: unknown) => void;
  /** The world's placeholders (World Editor only — a library character has no world to draw them from). */
  placeholders?: Placeholder[];
  /** The entity, as the owner of these fields: its own scoped placeholders read bare here and come first
   *  in every insert menu (World Editor only — a library character owns everything it carries). */
  ownerId?: string;
}

/** What every entity field group needs. */
export type EntityFieldGroupProps = DescribedFieldGroupProps<Entity>;

/** The short identity fields beside the picture, with Advanced-only Aliases and Type. */
export const EntityIdentityFields = ({ value, onChange, placeholders = [], ownerId, nameHandlers, home }: EntityFieldGroupProps & {
  /** What reports a committed rename of this entity, so the code that reaches its placeholders by path can
   *  follow. Absent outside the World Editor, where there is no world code to rewrite. */
  nameHandlers?: RenameFieldHandlers;
  /** Where the entity lives. Only a world entity shows the Stranger Name beside Name. */
  home?: EntityHome;
}) => {
  const { advanced } = useEditorMode();
  return (
    <>
      <SplitNameRow
        name={(
          <SplitNameField historyField="name" label="Name" tourAnchor="entity-name">
            <PlaceholderNameField
              value={value.name || ''}
              onChange={(v) => onChange('name', v)}
              placeholders={placeholders}
              ownerId={ownerId}
              ariaLabel="Name"
              {...nameHandlers}
            />
          </SplitNameField>
        )}
        partner={advanced && home === 'world' ? (
          <SplitNameField historyField="strangerName" label="Stranger Name" helpTopicId="worldEditor.strangerName">
            <PlaceholderNameField
              value={value.strangerName ?? ''}
              onChange={(v) => onChange('strangerName', v.trim() ? v : undefined)}
              placeholders={placeholders}
              ownerId={ownerId}
              ariaLabel="Stranger Name"
              placeholder="a hooded figure"
            />
          </SplitNameField>
        ) : undefined}
      />
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
      {advanced && <EntityQuoteColorField value={value} onChange={onChange} />}
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

const AUTO_QUOTE_COLOR = 'auto';
const QUOTE_COLOR_OPTIONS = QUOTE_SWATCHES.map((key) => ({ key, label: key[0].toUpperCase() + key.slice(1), color: swatchColor(key) }));

/** The swatch the entity's quotes take in narration. Each option shows in its own color, like the Font list. */
const EntityQuoteColorField = ({ value, onChange }: Pick<EntityFieldGroupProps, 'value' | 'onChange'>) => (
  <div className="space-y-2" {...fieldFrame('quoteColor')}>
    <Label htmlFor="entity-quote-color">Quote Color</Label>
    <Hint>Colors this entity’s quotes in the narration. Auto picks one.</Hint>
    <Select
      value={isQuoteSwatch(value.quoteColor) ? value.quoteColor : AUTO_QUOTE_COLOR}
      onValueChange={(v) => onChange('quoteColor', v === AUTO_QUOTE_COLOR ? undefined : v)}
    >
      <SelectTrigger id="entity-quote-color" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUTO_QUOTE_COLOR}>Auto</SelectItem>
        {QUOTE_COLOR_OPTIONS.map((o) => (
          <SelectItem key={o.key} value={o.key} style={{ color: o.color }}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/** What the player reads before meeting the entity, for `afterPlayer` on the Descriptions tab. World Editor and Advanced only. */
export const EntityStrangerDescriptionField = ({ value, onChange, placeholders = [], ownerId, home }: EntityFieldGroupProps & { home: EntityHome }) => {
  const { advanced } = useEditorMode();
  if (!advanced || home !== 'world') return null;
  return (
    <PlaceholderField
      label="Stranger Description"
      ariaLabel="Stranger Description"
      historyField="strangerDescription"
      labelAside={<HelpButton topicId="worldEditor.strangerDescription" className="h-6 w-6" />}
      value={value.strangerDescription ?? ''}
      onChange={(v) => onChange('strangerDescription', v.trim() ? v : undefined)}
      placeholders={placeholders}
      ownerId={ownerId}
      ownerName={value.name}
      resizable
    />
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
  // One History Step: the marks, the converted start places and the dropped routine fields land together.
  const apply = (next: PersonaRole) => spendFallback('Set Persona', next === 'custom' && !!value.vrmPick, () => {
    // Indexed by field name so every changed or dropped field is written through `onChange`.
    const converted = withPersonaRole(value, next, randomUUID) as unknown as Record<string, unknown>;
    const before = value as unknown as Record<string, unknown>;
    const marks = Object.keys(personaRolePatch(next));
    for (const field of new Set([...marks, ...Object.keys(before), ...Object.keys(converted)])) {
      if (marks.includes(field) || before[field] !== converted[field]) onChange(field, converted[field]);
    }
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
export const EntityDescriptionFields = ({ value, onChange, placeholders = [], ownerId, afterPlayer }: DescribedFieldGroupProps & {
  /** The replacement description, rendered directly under Player-Facing Description. */
  afterPlayer?: ReactNode;
}) => {
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
      {afterPlayer}
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
          hint={AI_SUMMARY_HINT}
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

/**
 * The entity's picture widget with neither piece placed: a host draws `ImageGallery` and `ImageTags` where
 * its own layout wants them and both still write this entity. `EntityGalleryField` is the one-box version.
 */
type EntityImageWidgetProps = DescribedFieldGroupProps & {
  children: ReactNode;
  /** A host that shows the framed image's details controls the frame. */
  frame?: GalleryFrameProps;
  /** The file inputs' id, unique per rendered widget. */
  imageId?: string;
  /** Absent = the record is an entity, and its rules read it. */
  ruleHost?: RuleHost;
  /** The record is a world entity, whose gallery links the world's Media List. */
  linked?: boolean;
};

export const EntityImageWidget = ({ linked, ...props }: EntityImageWidgetProps) =>
  (linked ? <LinkedEntityImageWidget {...props} /> : (
    <EntityImageBody {...props} images={entityImages(props.value)} onImagesChange={(list) => props.onChange('images', list)} />
  ));

const LinkedEntityImageWidget = (props: Omit<EntityImageWidgetProps, 'linked'>) => {
  const { value, onChange, placeholders = [] } = props;
  const write = useCallback((links: GalleryLink[]) => onChange('images', links), [onChange]);
  const gallery = useLinkedGallery(galleryLinks(value), write, labelPlaceholders(value.name, placeholders));
  return <EntityImageBody {...props} {...gallery} />;
};

const EntityImageBody = ({
  value, onChange, placeholders = [], ownerId, children, frame, imageId = `entity-image-${value.id}`, ruleHost, images, onImagesChange, media,
}: Omit<EntityImageWidgetProps, 'linked'> & { images: GalleryImage[]; onImagesChange: (next: GalleryImage[]) => void; media?: GalleryMedia }) => {
  const entityHost = useEntityRuleHost(value.id);
  return (
    <ImageWidget
      label="Image"
      tourAnchor={ruleHost ? undefined : 'entity-image'}
      images={images}
      onImagesChange={onImagesChange}
      media={media}
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
      ruleHost={ruleHost ?? entityHost}
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
  named: { value: string; label: string; blockedReason?: string | null }[];
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

export const ENTITY_VRM_HINT = 'Picks the Avatar this entity shows. Add Avatars on the Media tab.';

/** The entity's Avatar: none, the player's default, or one of the world's. World Editor, Simple and Advanced. */
export const EntityVrmPickField = ({ value, onChange }: EntityFieldGroupProps) => {
  const spendFallback = useSpendFallback();
  const store = useGameDataOptional()?.worldOverview?.vrmStore;
  const pick = (next: VrmPick | undefined) =>
    spendFallback('Set Avatar', !!next && !!value.customPersona, () => onChange('vrmPick', next));
  const named = Object.entries(store ?? {}).map(([id, vrm]) => ({ value: vrmPickValue({ kind: 'world', id }), label: vrm.name || 'Unnamed' }));
  return <AvatarPickField entityId={value.id} hint={ENTITY_VRM_HINT} named={named} stored={vrmPickValue(value.vrmPick)} onPick={pick} />;
};

export const LIBRARY_ENTITY_VRM_HINT = 'Picks the Avatar this entity shows. Add Avatars on the Avatars tab.';

/** A library entity's Avatar: none, the player's default, or one from the player's Avatar library. */
export const LibraryEntityVrmPickField = ({ value, onChange }: EntityFieldGroupProps) => {
  const [library, setLibrary] = useState<ModelMetadata[] | undefined>();
  const mounted = useMountedRef();
  const addBlock = useLibraryAddBlock();
  useEffect(() => {
    ModelStorageService.getModelMetadata()
      .then((models) => { if (mounted.current) setLibrary(models); })
      .catch(() => { /* An unreadable library offers None and User's Default only. */ });
  }, [mounted]);
  // A library Avatar saved from a Supporter Copy would ride into this entity's export, so it stays out of reach here.
  const named: { value: string; label: string; blockedReason?: string | null }[] = (library ?? []).map((model) => ({
    value: vrmPickValue({ kind: 'library', id: model.id }), label: model.name || 'Unnamed', blockedReason: addBlock(model),
  }));
  const stored = vrmPickValue(value.vrmPick);
  // Once the library is read, a library id it lacks keeps its own option, named as the link review names it.
  if (library && value.vrmPick?.kind === 'library' && !named.some((o) => o.value === stored)) {
    named.push({ value: stored, label: pickLabel(value.vrmPick, { world: new Map(), library: new Map() }) });
  }
  return <AvatarPickField entityId={value.id} hint={LIBRARY_ENTITY_VRM_HINT} named={named} stored={stored} onPick={(next) => onChange('vrmPick', next)} />;
};

/**
 * The Profile tab of both entity editors: the picture beside the short identity fields and its tags, then the
 * Persona mark, `locations` (World Editor only), the Avatar and the model at full width. The Stranger Name sits beside Name.
 * `columnsClassName` sets when the header splits into two columns, since each host's pane widens differently.
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
    <EntityImageWidget {...props} linked={home === 'world'}>
      <div className={`grid gap-4 ${columnsClassName}`}>
        <ImageGallery />
        <div className="space-y-4">
          <EntityIdentityFields {...props} nameHandlers={nameHandlers} home={home} />
          <ImageTags />
        </div>
      </div>
    </EntityImageWidget>
    <EntityPersonaField {...props} home={home} customPersonaEntityName={customPersonaEntityName} />
    {locations}
    {home === 'world' ? <EntityVrmPickField {...props} /> : <LibraryEntityVrmPickField {...props} />}
    <EntityModelField {...props} />
  </>
);
