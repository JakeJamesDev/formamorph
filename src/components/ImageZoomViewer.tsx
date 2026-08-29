import { useCallback, useRef, useState } from "react";
import { RemoteImg } from '@/lib/useRemoteImage';
import {
  TransformWrapper,
  TransformComponent,
  useControls,
  useTransformEffect,
  type ReactZoomPanPinchState,
} from "react-zoom-pan-pinch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { GalleryControls, type GalleryControlsProps } from "./GalleryControls";
import { Tip } from '@/components/ui/tooltip';

const MIN_SCALE = 1;
const MAX_SCALE = 8;

// Controls live in their own component so subscribing to the live scale (for the slider) re-renders
// only this bar — not the TransformWrapper subtree.
function ZoomControls() {
  const { instance, setTransform, zoomIn, zoomOut, resetTransform } = useControls();
  const [scale, setScale] = useState(MIN_SCALE);
  // Wheel zoom updates the controlled slider value, which makes Radix emit onValueChange for the
  // programmatic change too. Only treat it as zoom intent while the user is actually dragging.
  const draggingSlider = useRef(false);

  // Stable callback so useTransformEffect subscribes once instead of re-subscribing every tick.
  const onTransform = useCallback((ref: { state: ReactZoomPanPinchState }) => {
    setScale(ref.state.scale);
  }, []);
  useTransformEffect(onTransform);

  // Zoom to an absolute scale about the viewport center, keeping the centered point fixed — unlike
  // centerView(), which resets the pan (jarring while dragging the slider).
  const zoomToScale = (target: number) => {
    const wrapper = instance.wrapperComponent;
    const { scale: cur, positionX, positionY } = instance.state;
    if (!wrapper || !cur) return;
    const cx = wrapper.offsetWidth / 2;
    const cy = wrapper.offsetHeight / 2;
    const ratio = target / cur;
    setTransform(cx - (cx - positionX) * ratio, cy - (cy - positionY) * ratio, target, 0);
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-md border bg-background/80 p-2 shadow-md backdrop-blur">
      <Tip tip="Zoom out">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => zoomOut()}>
          <ZoomOut className="h-5 w-5" />
        </Button>
      </Tip>
      <Slider
        className="w-40"
        min={MIN_SCALE}
        max={MAX_SCALE}
        step={0.1}
        value={[scale]}
        onPointerDown={() => { draggingSlider.current = true; }}
        onValueChange={(v) => { if (draggingSlider.current) zoomToScale(v[0]); }}
        onValueCommit={() => { draggingSlider.current = false; }}
      />
      <Tip tip="Zoom in">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => zoomIn()}>
          <ZoomIn className="h-5 w-5" />
        </Button>
      </Tip>
      <Tip tip="Fit to screen">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => resetTransform()}>
          <Maximize className="h-5 w-5" />
        </Button>
      </Tip>
    </div>
  );
}

/**
 * Full-screen pan/zoom image viewer. Wraps react-zoom-pan-pinch in our own Dialog + Button/Slider
 * chrome so it matches the app theme (the library itself is unstyled — just transforms).
 *
 * `footer` hangs a caller's own control under the zoom bar. Opt-in, so the viewer stays bare everywhere
 * it shows a picture that has nothing to decide about it.
 */
export function ImageZoomViewer({ src, alt, open, onOpenChange, footer, gallery }: {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footer?: React.ReactNode;
  gallery?: GalleryControlsProps;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="group max-w-[95vw] w-[95vw] h-[90dvh] p-0 overflow-hidden bg-background/95">
        {/* Chevrons rather than swipe: a horizontal drag here is a pan, which the viewer exists for. */}
        {gallery && gallery.count > 1 && <GalleryControls {...gallery} counterClassName="top-2" />}
        <DialogTitle className="sr-only">{alt || "Image viewer"}</DialogTitle>
        {src && (
          <TransformWrapper
            key={src}
            minScale={MIN_SCALE}
            maxScale={MAX_SCALE}
            centerOnInit
            // Free panning: bounds clamp the picture to the viewport, which leaves nothing to drag at fit
            // scale and stops you pulling a zoomed detail out to the edge to compare it against something.
            // Double-click is the way back, so there is no way to lose the image off-screen.
            limitToBounds={false}
            // The post-wheel bounds "settle" animation collides with subsequent wheel events at a
            // steady cadence and locks the zoom — disable it.
            autoAlignment={{ disabled: true }}
            doubleClick={{ mode: "reset" }}
          >
            <>
              <ZoomControls />
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <RemoteImg src={src} alt={alt} className="max-w-full max-h-full object-contain select-none" />
              </TransformComponent>
            </>
          </TransformWrapper>
        )}
        {footer && (
          // Below the zoom bar rather than beside it: the bar is centered and sized to its own controls,
          // and widening it would shift the zoom slider around depending on who is hosting the viewer.
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">{footer}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
