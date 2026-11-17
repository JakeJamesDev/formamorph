/**
 * A sound slot on the Media List (Q17): empty, Import and Choose side by side with a sound URL box below;
 * filled, the player, a linked marker for a URL, a broken state when the audio fails, and the entry's name
 * field with Remove and Delete From World.
 */
import { useState, type ChangeEvent } from 'react';
import { Link as LinkIcon, Upload, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import AudioPlayer from '@/components/game/AudioPlayer';
import { useGameData } from '@/contexts/GameDataContext';
import { addedEntries } from '@/lib/mediaGallery';
import { isMediaRef, mediaEntry, urlFileName } from '@/lib/mediaList';
import { placeSound, resolveSound, type SoundValue } from '@/lib/mediaSounds';
import { isRemoteUrl, WEB_LINK_ERROR } from '@/lib/imageBytes';
import { readMediaFile, SoundUpload, UrlCommitField } from '@/lib/UtilityComponents';
import { useMountedRef } from '@/lib/useMountedRef';
import { cn } from '@/lib/utils';
import type { MediaAsset, MediaRef } from '@/types';
import { MediaChooseButton, MediaEntryBar } from './MediaPicker';

/** A sound field's new value: a link, an embedded file in a world with no list, or none. */
export type SoundWrite = MediaRef | MediaAsset | undefined;

/** An empty slot links nothing, so Choose dims no entry. */
const NONE_LINKED: ReadonlySet<string> = new Set();

export function MediaSoundSlot({ id, value, subject, onChange }: {
  id: string;
  value: SoundValue;
  /** Whose sound this is, for the fallback name of a file with none (Q10). */
  subject: string | undefined;
  onChange: (next: SoundWrite) => void;
}) {
  const { worldOverview, addMedia } = useGameData();
  const mounted = useMountedRef();
  const list = worldOverview.mediaList;
  const sound = resolveSound(value, list);
  const entry = isMediaRef(value) ? mediaEntry(list, value.mediaId, 'sound') : undefined;
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  // The file that failed to load; a new file gets a fresh chance.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  // A world without a list keeps its sounds embedded (Q26).
  if (!list) return <SoundUpload id={id} value={sound} onChange={onChange} />;

  const place = (file: Pick<MediaAsset, 'data'> & Partial<MediaAsset>) => {
    const placed = placeSound(list, file, subject);
    // The field's write first, so the History Step is the record's.
    onChange(placed.link);
    const added = addedEntries(list, placed.list);
    if (Object.keys(added).length) addMedia(added);
  };

  const takeFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void readMediaFile(file).then((read) => { if (mounted.current) place(read); });
  };

  const commitUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (!isRemoteUrl(url)) {
      setUrlError(WEB_LINK_ERROR);
      return;
    }
    setUrlDraft('');
    setUrlError(null);
    place({ data: url, name: urlFileName(url) });
  };

  if (sound) {
    const linked = isRemoteUrl(sound.data);
    return (
      <div className="space-y-2" data-sound-slot={id}>
        <div className="flex items-center gap-2">
          <AudioPlayer src={sound.data} className="flex-1" onError={() => setBrokenSrc(sound.data)} />
          {linked && (
            <Tip tip={`Plays only while online.\n${sound.data}`}>
              <span className="shrink-0"><Badge variant="outline" className="gap-1"><LinkIcon className="h-3 w-3" />Linked</Badge></span>
            </Tip>
          )}
        </div>
        {brokenSrc === sound.data && (
          <p className="text-meta text-destructive" data-sound-broken="">
            {linked ? "This sound couldn't be loaded. Check the link." : "This sound couldn't be played."}
          </p>
        )}
        {entry
          ? <MediaEntryBar entry={entry} onUnlink={() => onChange(undefined)} />
          : (
            <Tip tip="Remove Sound">
              <Button type="button" variant="ghost" size="sm" aria-label="Remove Sound" onClick={() => onChange(undefined)}>
                <X className="h-4 w-4" />
              </Button>
            </Tip>
          )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border-2 border-dashed p-3" data-sound-slot={id}>
      <input type="file" accept="audio/*" className="hidden" id={`sound-import-${id}`} onChange={takeFile} />
      <div className="grid grid-cols-2 gap-2">
        <Label htmlFor={`sound-import-${id}`} className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer')}>
          <Upload className="mr-2 h-4 w-4" />Import
        </Label>
        <MediaChooseButton kind="sound" list={list} linkedIds={NONE_LINKED} onPick={(picked) => onChange({ mediaId: picked.id })} />
      </div>
      <UrlCommitField
        noun="sound"
        value={urlDraft}
        onChange={(v) => { setUrlDraft(v); setUrlError(null); }}
        onCommit={commitUrl}
        error={urlError}
      />
    </div>
  );
}
