import { useCallback, useRef, useState } from "react";
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
      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => zoomOut()} title="Zoom out">
        <ZoomOut className="h-5 w-5" />
      </Button>
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
      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => zoomIn()} title="Zoom in">
        <ZoomIn className="h-5 w-5" />
      </Button>
      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => resetTransform()} title="Fit to screen">
        <Maximize className="h-5 w-5" />
      </Button>
    </div>
  );
}

/**
 * Full-screen pan/zoom image viewer. Wraps react-zoom-pan-pinch in our own Dialog + Button/Slider
 * chrome so it matches the app theme (the library itself is unstyled — just transforms).
 */
export function ImageZoomViewer({ src, alt, open, onOpenChange }: {
  src: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden bg-background/95">
        <DialogTitle className="sr-only">{alt || "Image viewer"}</DialogTitle>
        {src && (
          <TransformWrapper
            key={src}
            minScale={MIN_SCALE}
            maxScale={MAX_SCALE}
            centerOnInit
            centerZoomedOut
            // The post-wheel bounds "settle" animation collides with subsequent wheel events at a
            // steady cadence and locks the zoom — disable it.
            autoAlignment={{ disabled: true }}
            doubleClick={{ mode: "toggle" }}
          >
            <>
              <ZoomControls />
              <TransformComponent
                wrapperClass="!w-full !h-full"
                contentClass="!w-full !h-full flex items-center justify-center"
              >
                <img src={src} alt={alt} className="max-w-full max-h-full object-contain select-none" />
              </TransformComponent>
            </>
          </TransformWrapper>
        )}
      </DialogContent>
    </Dialog>
  );
}
