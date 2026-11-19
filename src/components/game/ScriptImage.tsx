import { useState } from 'react';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { RemoteImg } from '@/lib/useRemoteImage';
import type { ShowSize, ShowWrap } from '@/lib/scriptPrompts';
import { isImageTell, type ScriptImageTell, type ScriptTell } from '@/lib/scriptTells';
import { cn } from '@/lib/utils';
import type { MediaEntry, MediaList } from '@/types';

/** Each size's share of the column it sits in (Q21). */
const SIZE_WIDTH: Record<ShowSize, string> = { small: 'w-1/3', medium: 'w-3/5', large: 'w-full' };

/** The Media List image a shown image names, when the list still holds it as an image. */
export const shownEntry = (list: MediaList | undefined, tell: ScriptImageTell): MediaEntry | undefined => {
  const entry = list?.[tell.image];
  return entry?.kind === 'image' ? entry : undefined;
};

/** The tells that render, each image with its entry. An image no longer on the Media List drops out. */
export const shownTells = <T extends ScriptTell>(tells: readonly T[], list: MediaList | undefined): { tell: T; entry?: MediaEntry }[] =>
  tells.flatMap((tell) => {
    if (!isImageTell(tell)) return [{ tell }];
    const entry = shownEntry(list, tell);
    return entry ? [{ tell, entry }] : [];
  });

/** A float sits on one side with a gap on the text side. Below the mobile breakpoint it is a centered block. */
const FLOAT: Record<Exclude<ShowWrap, 'block'>, string> = {
  left: 'float-left mr-4 max-md:float-none max-md:mx-auto',
  right: 'float-right ml-4 max-md:float-none max-md:mx-auto',
};

/** The wrap an image renders with: a large image fills the column, so it is a block (Q31). */
const effectiveWrap = (wrap: ShowWrap, size: ShowSize): ShowWrap => (size === 'large' ? 'block' : wrap);

/** One image a script showed at its size's width: a centered block, or a float the text wraps (Q3). A click opens it full size (Q10). */
export function ScriptImage({ entry, size, wrap = 'block', className }: { entry: MediaEntry; size: ShowSize; wrap?: ShowWrap; className?: string }) {
  const [zoom, setZoom] = useState(false);
  const shownWrap = effectiveWrap(wrap, size);
  return (
    <figure
      data-testid="script-image"
      data-size={size}
      data-wrap={shownWrap}
      className={cn(shownWrap === 'block' ? 'mx-auto flow-root' : FLOAT[shownWrap], SIZE_WIDTH[size], className)}
    >
      <button
        type="button"
        aria-label="Zoom image"
        className="block w-full cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => setZoom(true)}
      >
        <RemoteImg src={entry.data} alt={entry.name} className="max-h-[70vh] w-full rounded-md object-contain" />
      </button>
      <ImageZoomViewer src={entry.data} alt={entry.name} open={zoom} onOpenChange={setZoom} />
    </figure>
  );
}
