import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { ImagePlus, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  IDENTITY_CROP, MAX_ZOOM, MIN_ZOOM, clampCrop, loadImageFile, renderCrop, type CropTransform,
} from "@/lib/avatarCrop";

/** The preview circle's diameter. Fixed, so the offsets never have to be rescaled mid-drag. */
const FRAME = 256;

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The picked file. Decoded when the dialog opens. */
  file: File | null;
  /** Hands back the cropped image as a `data:` URI, ready to send. */
  onCropped: (image: string) => void;
  /** Disables the buttons while the upload is in flight. */
  busy?: boolean;
}

/**
 * Choose which part of a picture becomes the circle.
 *
 * The preview is the crop rather than a picture of it: what the circle shows is exactly what is saved,
 * at the same proportions, so there is nothing to discover after pressing Save.
 */
export function AvatarCropDialog({ open, onOpenChange, file, onCropped, busy = false }: AvatarCropDialogProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [transform, setTransform] = useState<CropTransform>(IDENTITY_CROP);
  const [loading, setLoading] = useState(false);
  // Where the pointer went down, and where the crop was at that moment.
  const drag = useRef<{ x: number; y: number; from: CropTransform } | null>(null);

  const apply = useCallback((next: CropTransform) => {
    if (!image) return;

    setTransform(clampCrop(next, image.naturalWidth, image.naturalHeight, FRAME));
  }, [image]);

  // Decode on open. The object URL is revoked on the way out, and on a re-pick, so a long session of
  // trying pictures does not hold every one of them in memory.
  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      return;
    }

    let cancelled = false;
    let url: string | null = null;
    setLoading(true);
    setTransform(IDENTITY_CROP);

    loadImageFile(file)
      .then(({ image: loaded, objectUrl }) => {
        url = objectUrl;
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setImage(loaded);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        toast.error(error.message);
        onOpenChange(false);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, file, onOpenChange]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!image) return;

    drag.current = { x: event.clientX, y: event.clientY, from: transform };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const start = drag.current;
    if (!start) return;

    apply({
      ...start.from,
      offsetX: start.from.offsetX + (event.clientX - start.x),
      offsetY: start.from.offsetY + (event.clientY - start.y),
    });
  };

  const endDrag = (event: React.PointerEvent) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: React.WheelEvent) => {
    if (!image) return;

    // Down-scrolls zoom out, which is the direction every map and photo viewer uses.
    apply({ ...transform, zoom: transform.zoom - event.deltaY * 0.002 });
  };

  const save = () => {
    if (!image) return;

    try {
      onCropped(renderCrop(image, transform, FRAME));
    } catch (error) {
      toast.error((error as Error).message || 'That image could not be prepared');
    }
  };

  // The source is drawn at cover scale, then moved by the reader's pan. `background-size: cover` does the
  // first part; the zoom multiplies it and the offsets translate it.
  const style = image
    ? {
      backgroundImage: `url(${image.src})`,
      backgroundSize: `${transform.zoom * 100}%`,
      backgroundPosition: `calc(50% + ${transform.offsetX}px) calc(50% + ${transform.offsetY}px)`,
      backgroundRepeat: 'no-repeat',
    }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="h-4 w-4" /> Position Your Picture
          </DialogTitle>
          <DialogDescription>
            Drag to move it, scroll or use the slider to zoom. The circle is exactly what everyone sees.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <div
            role="img"
            aria-label="Profile image preview"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={onWheel}
            style={style}
            className="h-64 w-64 rounded-full border-2 border-border bg-muted touch-none cursor-grab active:cursor-grabbing"
          >
            {loading && (
              <span className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                Loading…
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-1">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[transform.zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            aria-label="Zoom"
            onValueChange={([zoom]) => apply({ ...transform, zoom })}
            disabled={!image}
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={!image || busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
