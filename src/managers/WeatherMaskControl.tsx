import { useRef, useState, type ChangeEvent } from 'react';
import { Contrast, Upload, X } from 'lucide-react';
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
import type { GalleryImage } from '@/types';
import { MediaChooseButton } from './MediaPicker';
import { useMediaStep } from './useMediaItemActions';

/** Choose dims nothing: a mask may be linked again on purpose. */
const NONE_LINKED: ReadonlySet<string> = new Set();

/**
 * One location image slot's Weather Mask: Upload and Choose with none, a thumbnail with Replace and Remove with one.
 * The open slot draws it disabled, so the row keeps its height as the author steps between slots.
 */
export function WeatherMaskControl({ images, index, onImagesChange, subject }: {
  /** The gallery's pictures, as the widget edits them. */
  images: readonly GalleryImage[];
  index: number;
  onImagesChange: (next: GalleryImage[]) => void;
  /** The location's name, placeholders labeled, for a new Mask's name and the History Step. */
  subject: string;
}) {
  const { worldOverview, locations, addMedia } = useGameData();
  const list = worldOverview.mediaList;
  const step = useMediaStep();
  const mounted = useMountedRef();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
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
  const picked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still fires.
    e.target.value = '';
    if (file) void trackWork(take(file));
  };

  return (
    <div className="flex h-12 items-center gap-2" data-weather-mask={entry?.id ?? ''}>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={picked} data-weather-mask-file="" />
      <span className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
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
      {entry
        ? (
          <>
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
  );
}
