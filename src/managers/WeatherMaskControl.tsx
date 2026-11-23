import { useRef, useState, type ChangeEvent } from 'react';
import { Brush, Contrast, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { RemoteImg } from '@/lib/useRemoteImage';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/linkToast';
import { trackWork } from '@/lib/pendingWork';
import { useMountedRef } from '@/lib/useMountedRef';
import { encodeMaskPng, maskEntry, maskUseCount, newMaskEntry, withSlotMask } from '@/lib/weatherMask';
import type { LayeredPicture } from '@/lib/layeredImages';
import type { GalleryImage } from '@/types';
import { MediaChooseButton } from './MediaPicker';
import { useMediaStep } from './useMediaItemActions';
import { WeatherMaskEditor } from './weatherMaskEditor/WeatherMaskEditor';

/** Choose dims nothing: a mask may be linked again on purpose. */
const NONE_LINKED: ReadonlySet<string> = new Set();

/**
 * One location image slot's Weather Mask: Paint, Upload and Choose with none, a thumbnail with Edit, Replace and
 * Remove with one. The open slot draws it disabled, so the row keeps its height as the author steps between slots.
 */
export function WeatherMaskControl({ images, index, onImagesChange, pictures, subject }: {
  /** The gallery's pictures, as the widget edits them. */
  images: readonly GalleryImage[];
  index: number;
  onImagesChange: (next: GalleryImage[]) => void;
  /** The composed picture behind each Layered Image tile, keyed by the tile's data. */
  pictures?: ReadonlyMap<string, LayeredPicture>;
  /** The location's name, placeholders labeled, for a new Mask's name and the History Step. */
  subject: string;
}) {
  const { worldOverview, locations, addMedia } = useGameData();
  const list = worldOverview.mediaList;
  const step = useMediaStep();
  const mounted = useMountedRef();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [painting, setPainting] = useState(false);
  const image = images[index] as GalleryImage | undefined;
  const entry = maskEntry(list, image?.weatherMask);
  const shared = entry ? maskUseCount(locations, entry.id) : 0;
  const disabled = !image || !list || reading;

  const link = (id: string | undefined) => onImagesChange(withSlotMask(images, index, id));

  const take = async (file: File) => {
    setReading(true);
    try {
      const data = await encodeMaskPng(file);
      if (!mounted.current) return;
      if (entry) {
        const { hash: _stale, ...rest } = entry;
        void step(`Replace Weather Mask: ${subject}`, () => addMedia({ [entry.id]: { ...rest, data, type: 'image/png' } }));
      } else {
        const added = newMaskEntry(list, data, file.name, subject);
        // The record's write first, so the History Step is the record's.
        void step(`Add Weather Mask: ${subject}`, () => {
          link(added.id);
          addMedia({ [added.id]: added });
        });
      }
    } catch (e: unknown) {
      toastError(e, { headline: "Couldn't read the file" });
    } finally {
      if (mounted.current) setReading(false);
    }
  };
  const painted = (data: string) => {
    setPainting(false);
    if (entry) {
      const { hash: _stale, ...rest } = entry;
      void step(`Edit Weather Mask: ${subject}`, () => addMedia({ [entry.id]: { ...rest, data, type: 'image/png' } }));
      return;
    }
    const added = newMaskEntry(list, data, undefined, subject);
    void step(`Paint Weather Mask: ${subject}`, () => {
      link(added.id);
      addMedia({ [added.id]: added });
    });
  };
  const paintButton = (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setPainting(true)} data-weather-mask-paint="">
      <Brush className="mr-1 h-4 w-4" />{entry ? 'Edit' : 'Paint'}
    </Button>
  );

  const picked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still fires.
    e.target.value = '';
    if (file) void trackWork(take(file));
  };

  return (
    // Two fixed lines, the actions under the name, so a narrow panel never squeezes the name.
    <div className="flex h-[4.75rem] flex-col justify-between" data-weather-mask={entry?.id ?? ''}>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={picked} data-weather-mask-file="" />
      <div className="flex h-9 items-center gap-2">
        <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
          {entry
            ? <RemoteImg src={entry.data} alt="" className="h-full w-full object-cover" />
            : <Contrast className="h-4 w-4 text-muted-foreground" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <Tip tip="Shows the weather on the white parts of this image" labelsChild={false}>
            <span className="block truncate"><Label className={cn(disabled && 'opacity-50')}>Weather Mask</Label></span>
          </Tip>
          <Meta className="truncate" data-weather-mask-shared={shared}>
            {/* The count leads, so a narrow panel truncates the name, never the count. */}
            {entry ? (shared >= 2 ? `Shared by ${shared} images · ${entry.name}` : entry.name) : 'None'}
          </Meta>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {entry
          ? (
            <>
              {paintButton}
              <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
                <Upload className="mr-1 h-4 w-4" />Replace
              </Button>
              <Tip tip="Removes the Weather Mask from this image and keeps it in the world">
                <Button type="button" variant="ghost" size="icon" aria-label="Remove Weather Mask" disabled={disabled} onClick={() => void step(`Remove Weather Mask: ${subject}`, () => link(undefined))}>
                  <X className="h-4 w-4" />
                </Button>
              </Tip>
            </>
          )
          : (
            <>
              {paintButton}
              <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
                <Upload className="mr-1 h-4 w-4" />Upload
              </Button>
              <MediaChooseButton
                kind="mask"
                list={list}
                linkedIds={NONE_LINKED}
                disabled={disabled}
                onPick={(chosen) => void step(`Add Weather Mask: ${subject}`, () => link(chosen.id))}
              />
            </>
          )}
      </div>
      {image && (
        <WeatherMaskEditor
          open={painting}
          pictures={[{ key: 'slot', label: '', picture: pictures?.get(image.data) ?? image.data }]}
          mask={entry?.data}
          sharedCount={shared}
          onSave={painted}
          onClose={() => setPainting(false)}
        />
      )}
    </div>
  );
}
