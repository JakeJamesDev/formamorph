import { useMemo, useState } from 'react';
import { Brush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameData } from '@/contexts/GameDataContext';
import { galleryLink, outsidePlayPicture } from '@/lib/entityImages';
import type { MediaUse } from '@/lib/mediaUsage';
import { labelPlaceholders } from '@/lib/placementLetters';
import { maskUseCount } from '@/lib/weatherMask';
import type { MediaFileEntry, Placeholder } from '@/types';
import { useMediaStep } from './useMediaItemActions';
import { WeatherMaskEditor, type PictureChoice } from './weatherMaskEditor/WeatherMaskEditor';

/**
 * A Mask's Edit button in the Media tab: opens the brush editor over a picture that links the mask, with a switch
 * between them, or over a plain surface at the mask's size when no slot links it. Save writes the entry alone.
 */
export function EditMaskButton({ entry, uses, placeholders }: {
  entry: MediaFileEntry;
  uses: readonly MediaUse[];
  placeholders: readonly Placeholder[];
}) {
  const { worldOverview, locations, addMedia } = useGameData();
  const step = useMediaStep();
  const [open, setOpen] = useState(false);
  const list = worldOverview.mediaList;
  const pictures = useMemo<PictureChoice[]>(() => uses.flatMap((use): PictureChoice[] => {
    if (use.field !== 'weatherMask' || use.owner.kind !== 'location' || use.index === undefined) return [];
    const link = galleryLink(locations.find((l) => l.id === use.owner.id)?.images?.[use.index]);
    const picture = link && outsidePlayPicture(link, list);
    return picture ? [{ key: `${use.owner.id}:${use.index}`, label: `${labelPlaceholders(use.owner.name, placeholders) || 'Unnamed'}, Image ${use.index + 1}`, picture }] : [];
  }), [uses, locations, list, placeholders]);

  const saved = (data: string) => {
    setOpen(false);
    const { hash: _stale, ...rest } = entry;
    void step(`Edit Weather Mask: ${entry.name}`, () => addMedia({ [entry.id]: { ...rest, data, type: 'image/png' } }));
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-edit-mask="">
        <Brush className="mr-1 h-4 w-4" />Edit
      </Button>
      <WeatherMaskEditor
        open={open}
        pictures={pictures}
        mask={entry.data}
        sharedCount={maskUseCount(locations, entry.id)}
        onSave={saved}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
