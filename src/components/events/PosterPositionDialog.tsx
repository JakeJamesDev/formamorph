import { useEffect, useState, useRef, type ReactNode } from "react";
import { Minus, Move, Plus, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { MAX_ZOOM, MIN_ZOOM } from "@/lib/avatarCrop";
import { CENTERED_PLACEMENT, clampPlacement, panPlacement } from "@/lib/posterStyle";
import { useElementSize } from "@/lib/useElementSize";
import { useImageSize } from "@/lib/useImageSize";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import type { PosterPlacement } from "@/types";

/** How much of the zoom range a wheel notch covers. The avatar's rate, so both surfaces feel the same. */
const ZOOM_PER_PIXEL = 0.002;

/** What one press of the plus or minus button is worth. */
const ZOOM_STEP = 0.25;

interface PosterPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The artwork being framed — a stored URL or the data URI of a fresh pick. */
  imageUrl: string | null;
  /** The framing already chosen, or null for the centered cover. Untouched until Save. */
  placement: PosterPlacement | null;
  onSave: (placement: PosterPlacement | null) => void;
  /** Renders the band being positioned from the form's current values, with the framing being tried. */
  children: (draft: PosterPlacement | null) => ReactNode;
}

/**
 * Choose which part of the artwork the poster band shows — the avatar dialog's flow, for a band.
 *
 * Its own dialog rather than an armed mode on the form's preview: a crop surface inside a scrolling
 * form fights it — a drag selects the band's own text, a wide pointer move scrolls the modal — where a
 * dialog whose body *is* the surface has nothing else to hit. It opens by itself when a picture is
 * picked and again from Reposition, and what it shows is the real band composed from the form's own
 * values, so what is framed here is what players are shown.
 *
 * The framing is a draft until Save: Cancel leaves whatever the form held, exactly as the avatar's
 * Cancel abandons its crop.
 */
export function PosterPositionDialog({
  open, onOpenChange, imageUrl, placement, onSave, children,
}: PosterPositionDialogProps) {
  const [draft, setDraft] = useState<PosterPlacement | null>(null);
  const [band, setBand] = useState<HTMLElement | null>(null);
  const [measure, frame] = useElementSize();
  const source = useImageSize(open ? imageUrl : null);
  // Where the pointer went down, and where the framing was at that moment.
  const drag = useRef<{ x: number; y: number; from: PosterPlacement } | null>(null);

  useResetOnOpen(open, () => setDraft(placement));

  const held = draft ?? CENTERED_PLACEMENT;
  // Nothing can be positioned before the band is laid out and the picture is decoded.
  const ready = !!source && frame.width > 0 && frame.height > 0;

  const apply = (next: PosterPlacement) => {
    if (!source) return;

    setDraft(clampPlacement(next, source, frame));
  };

  // The wheel is bound to the node rather than through React, whose own listener is passive: the zoom
  // has to stop anything behind it scrolling, and a passive handler cannot.
  useEffect(() => {
    if (!band || !ready || !source) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Down-scrolls zoom out, which is the direction every map and photo viewer uses.
      setDraft(clampPlacement({ ...held, zoom: held.zoom - event.deltaY * ZOOM_PER_PIXEL }, source, frame));
    };

    band.addEventListener('wheel', onWheel, { passive: false });
    return () => band.removeEventListener('wheel', onWheel);
  }, [band, ready, source, frame, held]);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!ready) return;

    drag.current = { x: event.clientX, y: event.clientY, from: held };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const start = drag.current;
    if (!start || !ready || !source) return;

    setDraft(panPlacement(
      start.from,
      { x: event.clientX - start.x, y: event.clientY - start.y },
      source,
      frame,
    ));
  };

  const endDrag = (event: React.PointerEvent) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const save = () => {
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="h-4 w-4" aria-hidden /> Position the Artwork
          </DialogTitle>
          <DialogDescription>
            Drag to move it, scroll or use the slider to zoom. The band is exactly what players see.
          </DialogDescription>
        </DialogHeader>

        {/* The surface is the measured node, borderless, so the frame the pan clamps against is the
            frame the band actually draws in. `select-none` because the band carries real text — the
            title, the date pill — and a drag across it must move the picture, not highlight words. */}
        <div className="overflow-hidden rounded-lg border">
          <div
            ref={(node) => { setBand(node); measure(node); }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="select-none touch-none cursor-grab active:cursor-grabbing"
            data-testid="poster-position-surface"
          >
            {children(draft)}
          </div>
        </div>

        <div className="flex items-center gap-2 px-1">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Slider
            value={[held.zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            aria-label="Poster zoom"
            onValueChange={([zoom]) => apply({ ...held, zoom })}
            disabled={!ready}
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Button
            variant="outline"
            size="icon"
            aria-label="Zoom out"
            disabled={!ready}
            onClick={() => apply({ ...held, zoom: held.zoom - ZOOM_STEP })}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Zoom in"
            disabled={!ready}
            onClick={() => apply({ ...held, zoom: held.zoom + ZOOM_STEP })}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="outline" size="sm" disabled={!draft} onClick={() => setDraft(null)}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Reset
          </Button>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!ready}>Save Position</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
