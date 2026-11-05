import { useEffect, useState } from 'react';

/** Drives a section that slides open and shut. `mounted` holds through the close so the slide can play,
 *  then drops; `open` is the visual state and flips one frame after mount so the open slide starts from closed.
 *  `instant` skips the slide for reduced motion. */
export function useSlidePresence(want: boolean, ms: number, instant: boolean): { mounted: boolean; open: boolean } {
  const [mounted, setMounted] = useState(want);
  const [open, setOpen] = useState(want);

  useEffect(() => {
    if (instant) return;
    if (want) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(frame);
    }
    setOpen(false);
    const timer = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [want, ms, instant]);

  // Derived, not synced in an effect, so a reduced-motion change lands in the same render as the click.
  return instant ? { mounted: want, open: want } : { mounted, open };
}
