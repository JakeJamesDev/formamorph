import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { useDanbooruTags } from "@/lib/useDanbooruTags";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/typography";
import { toastError } from '@/lib/linkToast';
import { ImageUpload, SoundUpload } from '../lib/UtilityComponents';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { GenerateImageButton } from '../components/GenerateImageButton';
import { ModelDetailsPanel } from '../components/modals/ModelDetailsPanel';
import { readVrmMeta } from '../lib/vrmMeta';
import { downloadBlob } from '@/lib/downloadBlob';
import { ActionIcon } from '@/lib/actionIcons';
import { useEditorMode } from '@/lib/editorMode';
import { ALLOWED_PERSONAS, limitsToWorld, worldPersonaRules } from '@/lib/personaPick';
import { customPersonaEntity } from '@/lib/blueprints';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AllowedPersonas, VrmLicense } from '@/types';

/**
 * The world's custom player VRM in the same details view the model library uses. The world stores the model
 * inline as a data URL rather than as a library record, so the bytes are decoded here and its license is read
 * from the file itself. Its own component so the work happens only while the preview is open.
 */
const PlayerVrmPreview = ({ data, fileName, open, onClose }: { data: string; fileName?: string; open: boolean; onClose: () => void }) => {
  const [url, setUrl] = useState<string | undefined>();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [meta, setMeta] = useState<{ license?: VrmLicense; size?: number }>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    fetch(data)
      .then((r) => r.blob())
      .then(async (loaded) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(loaded);
        setUrl(objectUrl);
        setBlob(loaded);
        const { license } = await readVrmMeta(loaded);
        if (!cancelled) setMeta({ license, size: loaded.size });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlob(null);
    };
  }, [data]);

  /** Save the stored bytes back out untouched, so the file's own metadata and license travel with it. */
  const handleExport = () => {
    if (!blob) return;
    // The uploaded filename is the best name available; falling back, a file with no VRM data is a plain glTF.
    const fallback = `Player Avatar.${meta.license?.metaVersion === null ? 'glb' : 'vrm'}`;
    downloadBlob(blob, fileName || fallback);
  };

  return (
    <ModelDetailsPanel
      open={open}
      name="Player Avatar"
      url={url}
      license={meta.license}
      size={meta.size}
      failed={failed}
      onClose={onClose}
      footer={
        <Button variant="outline" size="sm" className="w-full" onClick={handleExport} disabled={!blob}>
          <ActionIcon.export className="mr-2 h-4 w-4" /> Export
        </Button>
      }
    />
  );
};

const ALLOWED_PERSONAS_LABELS: Record<AllowedPersonas, string> = { any: 'Any', world: 'World Only' };

export const ALLOWED_PERSONAS_HINTS: Record<AllowedPersonas, string> = {
  any: 'Lets players pick any persona, their own included',
  world: 'Limits players to the personas this world defines',
};

export const WORLD_ONLY_WITHOUT_PERSONAS_HINT = 'Works like Any until you give an entity a Persona role';

export const START_PERSONA_HINT = 'Sets the persona new players start on. Returning players start on their last pick.';

const PLAYER_DEFAULT = 'default';
const NONE = 'none';

/** Which personas the player can pick, and which one a new player starts on. Advanced only; Any and the
 *  player's default write no field. */
const PersonaRulesFields = () => {
  const { worldOverview, updateWorldOverview, entities } = useGameData();
  const { allowed, start } = worldPersonaRules(worldOverview);
  const personas = entities.filter((entity) => entity.persona === true);
  const custom = customPersonaEntity(entities);
  const limited = limitsToWorld(allowed, { world: personas, custom });
  const hint = allowed === 'world' && !limited ? WORLD_ONLY_WITHOUT_PERSONAS_HINT : ALLOWED_PERSONAS_HINTS[allowed];

  const options = [
    ...(limited ? [] : [{ value: PLAYER_DEFAULT, label: "Player's Default" }]),
    ...(limited && !custom ? [] : [{ value: NONE, label: custom ? custom.name || 'Custom Persona' : 'None' }]),
    ...personas.map((entity) => ({ value: entity.id, label: entity.name || 'Unnamed' })),
  ];
  // Under World Only the absent pick is the first offered persona; a stale pick reads as the absent one.
  const stored = start?.source === 'world' ? start.entityId : start ? NONE : PLAYER_DEFAULT;
  const selected = options.some((o) => o.value === stored) ? stored : options[0]?.value;
  const writeStart = (v: string) => updateWorldOverview({
    startPersona: v === PLAYER_DEFAULT ? undefined : v === NONE ? { source: 'none' } : { source: 'world', entityId: v },
  });

  return (
    <>
      <div className="space-y-2">
        <Label id="allowed-personas-label">Allowed Personas</Label>
        <ToggleGroup
          type="single"
          aria-labelledby="allowed-personas-label"
          value={allowed}
          // A single ToggleGroup clears on a second click of the active item; the setting always has a value.
          onValueChange={(v) => {
            const next = ALLOWED_PERSONAS.find((s) => s === v);
            if (next) updateWorldOverview({ allowedPersonas: next === 'any' ? undefined : next });
          }}
          className="flex w-fit"
        >
          {ALLOWED_PERSONAS.map((value) => (
            <ToggleGroupItem key={value} value={value} className="px-3">{ALLOWED_PERSONAS_LABELS[value]}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Hint>{hint}</Hint>
      </div>
      <div className="space-y-2">
        <Label htmlFor="start-persona">Starts On</Label>
        <Hint>{START_PERSONA_HINT}</Hint>
        <Select value={selected} onValueChange={writeStart}>
          <SelectTrigger id="start-persona" className="w-64 max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );
};

const WorldOverviewManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const { advanced } = useEditorMode();
  const tagOptions = useDanbooruTags();
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const [vrmPreviewOpen, setVrmPreviewOpen] = useState(false);
  // Mounted on first open and kept mounted from then on: decoding a VRM's tens of megabytes shouldn't happen
  // just because the tab is showing, but unmounting on close would cut the dialog's close animation short.
  const [vrmPreviewMounted, setVrmPreviewMounted] = useState(false);

  const handleVRMChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          updateWorldOverview({
            // Keep the filename: browsers report an empty MIME for .vrm, so it's the only format hint, and
            // it's the name the avatar is exported back out under.
            customPlayerVRM: { data: e.target?.result as string, type: file.type || 'model/vrm', name: file.name },
          });
        } catch (error) {
          console.error('Error processing VRM:', error);
          toastError(error, { headline: 'Error processing player avatar. Please try again.' });
        }
      };
      reader.onerror = () => {
        toastError(reader.error, { headline: 'Error reading file. Please try again.' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVRMClick = () => {
    vrmInputRef.current?.click();
  };

  return (
    // The listing fields first, then the avatar setting, then the music: the library card's name, author,
    // tags and picture read as one block.
    <div className="space-y-4">
      <div className="space-y-2" data-tour-anchor="world-name">
        <Label htmlFor="worldName">World Name</Label>
        <Input
          id="worldName"
          value={worldOverview.name}
          onChange={(e) => updateWorldOverview({ name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="worldAuthor">Author</Label>
        <Input
          id="worldAuthor"
          value={worldOverview.author}
          onChange={(e) => updateWorldOverview({ author: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Tags</Label>
        <TokenAutocomplete
          values={worldOverview.tags || []}
          onChange={(tags) => updateWorldOverview({ tags })}
          options={tagOptions}
          preserveOrder
          reorderable
          editable
          placeholder="Add tags"
        />
      </div>
      <div className="space-y-2" data-tour-anchor="world-thumbnail" {...targetAttribute('worldEditor.overview', 'thumbnail')}>
        <Label htmlFor="image-upload-thumbnail">Thumbnail</Label>
        {/* The frame and its Generate button share one box, so the button is as wide as the picture it
            makes rather than centered under it. */}
        <div className="mx-auto w-full max-w-[400px] space-y-2">
          <ImageUpload
            id="thumbnail"
            value={worldOverview.thumbnail}
            onChange={(v) => updateWorldOverview({ thumbnail: v })}
            cap={IMAGE_CAPS.thumbnail}
            objectFit="cover"
            previewClassName="w-full aspect-video relative rounded-md"
          />
          <GenerateImageButton
            subject={{ description: worldOverview.description || worldOverview.systemPrompt || '', kind: 'world' }}
            cap={IMAGE_CAPS.thumbnail}
            onChange={(v) => updateWorldOverview({ thumbnail: v })}
            className="w-full"
          />
        </div>
      </div>
      {/* A checkbox row carries its hint inline after the caption, as the trait panel's does. */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="use3DModel"
          checked={worldOverview.use3DModel}
          onCheckedChange={(checked) => updateWorldOverview({ use3DModel: checked === true })}
        />
        <Label htmlFor="use3DModel">3D Player Avatar</Label>
        <Hint as="span">The player can customize it</Hint>
      </div>
      {/* Advanced only: a Simple-mode world keeps whatever avatar it carries and the bundled one otherwise,
          the way it keeps a prompt it does not offer to edit. */}
      {advanced && worldOverview.use3DModel && (
        <div className="space-y-2">
          <Label htmlFor="customVRM">Custom Player Avatar</Label>
          <Hint>Overrides the default 3D player model</Hint>
          <input
            ref={vrmInputRef}
            id="customVRM"
            type="file"
            accept=".vrm,.glb"
            onChange={handleVRMChange}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleVRMClick}
              className="flex-1"
            >
              {worldOverview.customPlayerVRM ? "Change Player Avatar" : "Add Player Avatar"}
            </Button>
            {worldOverview.customPlayerVRM && (
              <>
                <Button variant="outline" onClick={() => { setVrmPreviewMounted(true); setVrmPreviewOpen(true); }}>
                  Preview
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updateWorldOverview({ customPlayerVRM: null })}
                >
                  Remove
                </Button>
              </>
            )}
          </div>
          {worldOverview.customPlayerVRM?.data && vrmPreviewMounted && (
            <PlayerVrmPreview
              data={worldOverview.customPlayerVRM.data}
              fileName={worldOverview.customPlayerVRM.name}
              open={vrmPreviewOpen}
              onClose={() => setVrmPreviewOpen(false)}
            />
          )}
        </div>
      )}
      {advanced && <PersonaRulesFields />}
      <div className="space-y-2" {...targetAttribute('worldEditor.overview', 'background-music')}>
        <Label htmlFor="sound-upload-world-bgm">Background Music</Label>
        {/* The world stores a bare data URL where a location stores a media record, so the shared widget
            is fed one and read back for its bytes alone. */}
        <SoundUpload
          id="world-bgm"
          value={worldOverview.bgm ? { data: worldOverview.bgm } : null}
          onChange={(media) => updateWorldOverview({ bgm: media?.data ?? null })}
        />
      </div>
    </div>
  );
};

export default WorldOverviewManager;
