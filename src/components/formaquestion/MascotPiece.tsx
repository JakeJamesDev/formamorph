import { useLayoutEffect, useRef } from 'react';
import type { MascotImageRef } from '@/lib/formaquestion/mascot';
import type { MascotFrame, MascotSize } from '@/lib/formaquestion/mascotMask';
import { useMascotImageUrls } from './useMascotImageUrls';

/**
 * The Mascot: the composition's images, bottom first, each stretched to the base size. The first image is
 * the base; its natural size gives the aspect the caller lays the piece out at.
 */
export function MascotPiece({ images, hold = [], size, frame, view = 'full', onBase }: {
  /** The composition, as `composeMascot` returns it. */
  images: readonly MascotImageRef[];
  /** Images to keep resolved while they are not drawn, such as the whole rig, so a change of look draws at once. */
  hold?: readonly MascotImageRef[];
  /** Null until the aspect is known: the piece draws at no size. */
  size: { w: number; h: number } | null;
  /** Where the whole base draws in the piece, for a crop such as the head view. Unset fills the piece. */
  frame?: MascotFrame;
  view?: 'full' | 'head';
  /** The base's natural size, once it loads and whenever it changes. */
  onBase: (size: MascotSize) => void;
}) {
  const urlOf = useMascotImageUrls([...hold, ...images]);
  const baseRef = useRef<HTMLImageElement>(null);
  const reported = useRef('');
  const report = () => {
    const base = baseRef.current;
    if (!base || base.naturalWidth <= 0 || base.naturalHeight <= 0) return;
    const key = `${base.naturalWidth}x${base.naturalHeight}`;
    if (key === reported.current) return;
    reported.current = key;
    onBase({ width: base.naturalWidth, height: base.naturalHeight });
  };
  // A cached base can finish loading before the load handler attaches.
  useLayoutEffect(report);
  return (
    <div
      aria-hidden
      data-fq-piece="mascot"
      data-fq-view={view}
      className="pointer-events-none relative shrink-0 self-end overflow-hidden"
      style={size ? { width: size.w, height: size.h } : { width: 0, height: 0 }}
    >
      <div
        className="absolute"
        style={frame
          ? { left: `${frame.left}%`, top: `${frame.top}%`, width: `${frame.width}%`, height: `${frame.height}%` }
          : { inset: 0 }}
      >
        {images.map((ref, index) => {
          const url = urlOf(ref);
          if (url === null) return null;
          return (
            <img
              // The same image can draw twice, so the place in the list is part of the key.
              key={`${index}-${url}`}
              ref={index === 0 ? baseRef : undefined}
              src={url}
              alt=""
              draggable={false}
              onLoad={index === 0 ? report : undefined}
              className="absolute inset-0 h-full w-full select-none"
            />
          );
        })}
      </div>
    </div>
  );
}
