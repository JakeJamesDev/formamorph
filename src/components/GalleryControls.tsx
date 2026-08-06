import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface GalleryControlsProps {
  /** How many pictures the gallery holds. */
  count: number;
  /** Which one is showing, zero-based. */
  index: number;
  /** Move by whole steps; the caller wraps. */
  onStep: (by: number) => void;
  /** Where the counter sits, for hosts whose bottom edge is already spoken for (the zoom bar). */
  counterClassName?: string;
}

// Faded at rest and full on hover. A touch device has no hover to fade in from, so the controls sit at their
// resting opacity there instead of never appearing.
const FADE =
  'opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 ' +
  'motion-reduce:transition-none [@media(hover:none)]:opacity-60';

/**
 * The chevrons and `x/y` counter for paging a gallery, laid over whatever is showing it. Positioned
 * absolutely, so the host must be `relative` and carry `group` for the hover fade to reach them.
 */
export function GalleryControls({ count, index, onStep, counterClassName = 'bottom-1' }: GalleryControlsProps) {
  const arrow = (dir: -1 | 1) => (
    <button
      type="button"
      aria-label={dir < 0 ? 'Previous image' : 'Next image'}
      onClick={(e) => { e.stopPropagation(); onStep(dir); }}
      className={`absolute top-1/2 -translate-y-1/2 ${dir < 0 ? 'left-1' : 'right-1'} z-10 rounded-full bg-overlay/50 p-1 text-white hover:bg-overlay/70 ${FADE}`}
    >
      {dir < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );

  return (
    <>
      {arrow(-1)}
      {arrow(1)}
      <div
        // Not a live region: it narrates the arrows, which already say what they do.
        aria-hidden
        className={`absolute ${counterClassName} left-1/2 -translate-x-1/2 z-10 rounded-full bg-overlay/50 px-2 py-0.5 text-xs text-white ${FADE}`}
      >
        {index + 1}/{count}
      </div>
    </>
  );
}
