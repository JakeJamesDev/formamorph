import { useEffect, useState } from 'react';
import type { ElementSize } from '@/lib/useElementSize';

/**
 * The natural size of an image, once the browser has decoded it.
 *
 * Needed wherever a picture drawn as a CSS background has to be positioned by hand: `background-size`
 * can cover a box without anyone knowing the source's proportions, but placing a chosen point of it
 * cannot. The decode is the same fetch the background already makes, so it is served from cache.
 *
 * Null while there is nothing to measure or nothing decoded yet, which readers show their unplaced
 * default for rather than a guess they would then have to correct on screen.
 *
 * @param url - Where the image loads from, or null to measure nothing
 * @returns Its natural size, or null
 */
export function useImageSize(url: string | null | undefined): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null);

  useEffect(() => {
    setSize(null);
    if (!url) return;

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (!cancelled) setSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    // A source that cannot be decoded stays unmeasured, which is the same as unplaced.
    image.src = url;

    return () => { cancelled = true; };
  }, [url]);

  return size;
}
