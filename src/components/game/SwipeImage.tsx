import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Past this fraction of the picture's width, letting go commits the swipe instead of springing back. */
const COMMIT_FRACTION = 0.25;
const SETTLE_MS = 200;

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The picture in a gallery, draggable sideways on touch. The neighbor being dragged toward is laid over the
 * frame at a full width's offset so it enters as the current one leaves; letting go past a quarter of the
 * width commits that step, anything less springs back.
 *
 * Only the current picture is in flow, so the frame stays sized to it rather than to the widest in the
 * gallery — a mid-drag resize would drag the layout around with the finger.
 *
 * Mouse drags are left alone: on a pointer device the chevrons are the affordance, and a drag on an image is
 * far more likely to be a selection or a drag-out than a swipe.
 */
export function SwipeImage({ images, index, onStep, alt, onZoom, className }: {
  images: string[];
  index: number;
  onStep: (by: number) => void;
  alt: string;
  onZoom: () => void;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  // Non-null while a settle animation is running: the direction it will commit once the transition ends.
  const [settling, setSettling] = useState<-1 | 0 | 1 | null>(null);
  const [dx, setDx] = useState(0);

  const swipeable = images.length > 1;
  const width = () => frame.current?.offsetWidth || 1;
  const at = (offset: number) => images[(((index + offset) % images.length) + images.length) % images.length];

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!swipeable || e.pointerType === 'mouse' || settling !== null) return;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    setDx(e.clientX - startX.current);
  };

  const onPointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    // Dragging left (negative) walks forward through the gallery, as a page turn does.
    const step = Math.abs(dx) > width() * COMMIT_FRACTION ? (dx < 0 ? 1 : -1) : 0;
    if (step && prefersReducedMotion()) {
      setDx(0);
      onStep(step);
      return;
    }
    setSettling(step);
    setDx(step ? -step * width() : 0);
  };

  const onSettled = () => {
    if (settling === null) return;
    if (settling) onStep(settling);
    setSettling(null);
    setDx(0);
  };

  // The neighbor to render alongside, on the side the finger is pulling from.
  const incoming = dx === 0 ? null : dx < 0 ? 1 : -1;

  return (
    <div
      ref={frame}
      className={`relative touch-pan-y ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="relative"
        style={{
          transform: `translateX(${dx}px)`,
          transition: settling !== null ? `transform ${SETTLE_MS}ms ease-out` : undefined,
        }}
        onTransitionEnd={onSettled}
      >
        <img
          src={at(0)}
          alt={alt}
          className="max-w-full max-h-full object-contain cursor-zoom-in select-none"
          title="Click to enlarge"
          draggable={false}
          onClick={() => { if (dx === 0) onZoom(); }}
        />
        {incoming !== null && (
          <img
            src={at(incoming)}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain select-none"
            style={{ transform: `translateX(${incoming * 100}%)` }}
          />
        )}
      </div>
    </div>
  );
}
