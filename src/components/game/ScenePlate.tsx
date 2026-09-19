import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { Tip } from '@/components/ui/tooltip';
import { dataUrlImageSize } from '@/lib/imageBytes';
import { cn } from '@/lib/utils';

// The plate shows at most this tall.
const IMAGE_MAX_REM = 18;
const CONTROL = 'flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white disabled:opacity-40';

/**
 * One turn's scene images: the newest in view, zoom on click, and an overlay to browse and delete that
 * shows on hover and on focus within. The box takes its size from the image header, so the text below
 * does not move when the image decodes.
 */
export function ScenePlate({ turnId, images, onDelete, className }: {
  /** A new turn opens on its newest image. */
  turnId?: string;
  images: string[];
  /** Deletes the image at this index of `images`. */
  onDelete: (index: number) => void;
  className?: string;
}) {
  const newest = Math.max(0, images.length - 1);
  const [view, setView] = useState({ turnId, count: images.length, index: newest });
  const [zoom, setZoom] = useState(false);
  // Another turn or a changed image count opens on the newest image.
  if (view.turnId !== turnId || view.count !== images.length) {
    setView({ turnId, count: images.length, index: newest });
  }
  const at = Math.min(view.index, newest);
  const src = images[at] as string | undefined;
  const size = useMemo(() => (src ? dataUrlImageSize(src) : null), [src]);

  if (!src) return null;
  const ratio = size ? size.width / size.height : 1;
  const go = (index: number) => setView((v) => ({ ...v, index }));

  return (
    <figure className={cn('group relative mx-auto w-fit max-w-full', className)}>
      <button
        type="button"
        aria-label="Zoom image"
        className="block max-w-full cursor-zoom-in overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ aspectRatio: size ? `${size.width} / ${size.height}` : '1 / 1', width: `min(100%, ${IMAGE_MAX_REM * ratio}rem)` }}
        onClick={() => setZoom(true)}
      >
        <img src={src} alt="Scene illustration" className="h-full w-full object-contain" />
      </button>
      <ImageZoomViewer src={src} alt="Scene illustration" open={zoom} onOpenChange={setZoom} />
      <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-md bg-black/70 px-1 text-meta text-white opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none">
        {images.length > 1 && (
          <>
            <Tip tip="Previous image">
              <button type="button" aria-label="Previous image" className={CONTROL} disabled={at === 0} onClick={() => go(at - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
            </Tip>
            <span className="tabular-nums">{at + 1}/{images.length}</span>
            <Tip tip="Next image">
              <button type="button" aria-label="Next image" className={CONTROL} disabled={at >= newest} onClick={() => go(at + 1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </Tip>
          </>
        )}
        <Tip tip="Delete this image">
          <button type="button" aria-label="Delete this image" className={CONTROL} onClick={() => onDelete(at)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </Tip>
      </div>
    </figure>
  );
}
