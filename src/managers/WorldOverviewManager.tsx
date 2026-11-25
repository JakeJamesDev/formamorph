import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { Label } from "@/components/ui/label";
import { TokenAutocomplete } from "@/components/TokenAutocomplete";
import { useDanbooruTags } from "@/lib/useDanbooruTags";
import { Hint } from "@/components/ui/typography";
import { LinkedImageUpload, useSinglePlacement } from './MediaPicker';
import { COVER_SUBJECT, storedCover } from '@/lib/mediaImages';
import { MediaSoundSlot } from './MediaSoundSlot';
import { MUSIC_SUBJECT, storedMusic } from '@/lib/mediaSounds';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { IMAGE_CAPS } from '../lib/imageOptim';
import { GenerateImageButton } from '../components/GenerateImageButton';
import { useEditorMode } from '@/lib/editorMode';
import { worldStartPersona } from '@/lib/personaPick';
import { customPersonaEntity } from '@/lib/blueprints';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { WorldWeatherFields } from './WorldWeatherFields';

export const START_PERSONA_HINT = 'New players start on this persona and can pick another. Returning players start on their last pick.';

const PLAYER_DEFAULT = 'default';
const NONE = 'none';

/** The persona a new player starts on. Advanced only; the player's default writes no field. */
const StartPersonaField = () => {
  const { worldOverview, updateWorldOverview, entities, placeholders } = useGameData();
  const start = worldStartPersona(worldOverview);
  const personas = useMemo(() => entities.filter((entity) => entity.persona === true), [entities]);
  const custom = useMemo(() => customPersonaEntity(entities), [entities]);

  const options = useMemo(() => [
    { value: PLAYER_DEFAULT, label: "Player's Default" },
    { value: NONE, label: custom ? custom.name || 'Custom Persona' : 'None' },
    ...personas.map((entity) => ({ value: entity.id, label: entity.name || 'Unnamed' })),
  ], [custom, personas]);
  // A stale pick reads as the player's default.
  const stored = start?.source === 'world' ? start.entityId : start ? NONE : PLAYER_DEFAULT;
  const selected = options.some((o) => o.value === stored) ? stored : PLAYER_DEFAULT;
  const writeStart = (v: string) => updateWorldOverview({
    startPersona: v === PLAYER_DEFAULT ? undefined : v === NONE ? { source: 'none' } : { source: 'world', entityId: v },
  });

  return (
    <div className="space-y-2" {...fieldFrame('startPersona')}>
      <Label htmlFor="start-persona">Starting Persona</Label>
      <Hint>{START_PERSONA_HINT}</Hint>
      <Select value={selected} onValueChange={writeStart}>
        <SelectTrigger id="start-persona" className="w-64 max-w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}><PlaceholderText text={o.label} placeholders={placeholders} /></SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const WorldOverviewManager = () => {
  const { worldOverview, updateWorldOverview } = useGameData();
  const placeCover = useSinglePlacement(COVER_SUBJECT);
  const { advanced } = useEditorMode();
  const tagOptions = useDanbooruTags();

  return (
    // The listing fields first, then the music: the library card's name, author, tags and image read as one block.
    <div className="space-y-4">
      <div className="space-y-2" data-tour-anchor="world-name" {...fieldFrame('name')}>
        <Label htmlFor="worldName">World Name</Label>
        <WorldInput
          id="worldName"
          value={worldOverview.name}
          onChange={(e) => updateWorldOverview({ name: e.target.value })}
        />
      </div>
      <div className="space-y-2" {...fieldFrame('author')}>
        <Label htmlFor="worldAuthor">Author</Label>
        <WorldInput
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
          <LinkedImageUpload
            id="thumbnail"
            value={worldOverview.thumbnail}
            subject={COVER_SUBJECT}
            onChange={(link) => updateWorldOverview({ thumbnail: storedCover(link) })}
            cap={IMAGE_CAPS.thumbnail}
            objectFit="cover"
            previewClassName="w-full aspect-video relative rounded-md"
          />
          <GenerateImageButton
            subject={{ description: worldOverview.description || worldOverview.systemPrompt || '', kind: 'world' }}
            cap={IMAGE_CAPS.thumbnail}
            onChange={(v) => placeCover(v, undefined, (link) => updateWorldOverview({ thumbnail: storedCover(link) }))}
            className="w-full"
          />
        </div>
      </div>
      {advanced && <StartPersonaField />}
      <WorldWeatherFields />
      <div className="space-y-2" {...targetAttribute('worldEditor.overview', 'background-music')}>
        <Label htmlFor="sound-import-world-bgm">Background Music</Label>
        <MediaSoundSlot
          id="world-bgm"
          value={worldOverview.bgm}
          subject={MUSIC_SUBJECT}
          onChange={(next) => updateWorldOverview({ bgm: storedMusic(next) })}
        />
      </div>
    </div>
  );
};

export default WorldOverviewManager;
