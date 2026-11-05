import { useEffect, useState } from 'react';

/** Drives a slide: `mounted` holds through the close, and `open` flips one frame after mount. */
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
