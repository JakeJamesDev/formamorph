// What the Layered Image editor reads off a picture's pixels: its size, and the box its drawn pixels fill.

import { useEffect, useState } from 'react';
import type { ImageSize } from './layeredImages';

/** A box as fractions of the image: left, top, width, height. */
export interface DrawnBox { x: number; y: number; w: number; h: number }

export interface ImageFacts {
  size: ImageSize;
  /** Null when every pixel is transparent, or the pixels can't be read. */
  box: DrawnBox | null;
}

/** The grid the alpha scan samples. Fine enough to find a part, cheap enough to run per Variant. */
const SCAN = 96;
/** Alpha above this counts as drawn, so soft shadows don't spread the box. */
const DRAWN_ALPHA = 24;

/** The box of the drawn pixels in RGBA `data` of `width` × `height`. */
export function drawnBox(data: Uint8ClampedArray, width: number, height: number): DrawnBox | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= DRAWN_ALPHA) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0 / width, y: y0 / height, w: (x1 - x0 + 1) / width, h: (y1 - y0 + 1) / height };
}

/** How many sources the cache keeps; the oldest goes first. */
const CACHE_SIZE = 256;
const cache = new Map<string, Promise<ImageFacts | null>>();

/** `src`'s facts, loaded once per source while cached. Null when it never loads, and a later call tries again. */
export function imageFacts(src: string): Promise<ImageFacts | null> {
  const held = cache.get(src);
  if (held) return held;
  const oldest = cache.size >= CACHE_SIZE ? cache.keys().next().value : undefined;
  if (oldest !== undefined) cache.delete(oldest);
  const read = new Promise<ImageFacts | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      if (!size.width || !size.height) { resolve(null); return; }
      let box: DrawnBox | null = null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SCAN;
        canvas.height = SCAN;
        const g = canvas.getContext('2d', { willReadFrequently: true });
        if (g) {
          g.drawImage(img, 0, 0, SCAN, SCAN);
          box = drawnBox(g.getImageData(0, 0, SCAN, SCAN).data, SCAN, SCAN);
        }
      } catch {
        // A cross-origin image taints the canvas; its thumbnail shows whole.
      }
      resolve({ size, box });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  cache.set(src, read);
  void read.then((facts) => { if (!facts) cache.delete(src); });
  return read;
}

/** The facts of each source, by source, filled in as they load. */
export function useImageFacts(srcs: readonly string[]): ReadonlyMap<string, ImageFacts> {
  const key = [...new Set(srcs)].sort().join('\n');
  const [facts, setFacts] = useState<ReadonlyMap<string, ImageFacts>>(new Map());
  useEffect(() => {
    let live = true;
    const wanted = key ? key.split('\n') : [];
    void Promise.all(wanted.map(async (src) => [src, await imageFacts(src)] as const)).then((read) => {
      if (!live) return;
      setFacts(new Map(read.flatMap(([src, f]) => (f ? [[src, f] as const] : []))));
    });
    return () => { live = false; };
  }, [key]);
  return facts;
}

/** The union of `boxes`, padded by `pad` of its longer side; null when none is known. */
export function unionBox(boxes: readonly (DrawnBox | null | undefined)[], pad = 0.12): DrawnBox | null {
  const known = boxes.filter((b): b is DrawnBox => !!b);
  if (!known.length) return null;
  const x0 = Math.min(...known.map((b) => b.x)), y0 = Math.min(...known.map((b) => b.y));
  const x1 = Math.max(...known.map((b) => b.x + b.w)), y1 = Math.max(...known.map((b) => b.y + b.h));
  const p = pad * Math.max(x1 - x0, y1 - y0);
  return { x: x0 - p, y: y0 - p, w: x1 - x0 + 2 * p, h: y1 - y0 + 2 * p };
}
