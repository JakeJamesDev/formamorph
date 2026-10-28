import { useCallback, useEffect, useRef, useState } from 'react';
import { mascotImageKey, type MascotImageRef } from '@/lib/formaquestion/mascot';
import { supporterLayerOf } from '@/lib/formaquestion/supporterMascot';
import { supporterContent, unscrambleToCanvas } from '@/lib/supporterContent';
import { useMascotImageUrls } from './useMascotImageUrls';

/** What draws one rig image: a URL, or for Supporter content an unscrambled canvas that never leaves memory. */
export type MascotImageSource =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'canvas'; readonly canvas: HTMLCanvasElement };

type SupporterRef = Extract<MascotImageRef, { kind: 'supporter' }>;

/**
 * A resolver from a Supporter ref to its unscrambled layer: null until the layer is rebuilt, and when the
 * module no longer serves the item. Each listing's content is read once per change of `refs`.
 */
function useSupporterLayers(refs: readonly MascotImageRef[]): (ref: SupporterRef) => HTMLCanvasElement | null {
  const [layers, setLayers] = useState<ReadonlyMap<string, HTMLCanvasElement>>(new Map());
  const held = useRef(new Map<string, HTMLCanvasElement>());
  const wanted = refs.filter((ref): ref is SupporterRef => ref.kind === 'supporter');
  const key = [...new Set(wanted.map(mascotImageKey))].sort().join('\n');
  const latest = useRef(wanted);
  latest.current = wanted;

  useEffect(() => {
    const keys = new Set(key ? key.split('\n') : []);
    let alive = true;
    for (const kept of [...held.current.keys()]) if (!keys.has(kept)) held.current.delete(kept);
    setLayers(new Map(held.current));
    const byListing = new Map<string, Map<string, SupporterRef>>();
    for (const ref of latest.current) {
      const refKey = mascotImageKey(ref);
      if (held.current.has(refKey)) continue;
      const listing = byListing.get(ref.id) ?? new Map<string, SupporterRef>();
      byListing.set(ref.id, listing.set(refKey, ref));
    }
    for (const [id, listingRefs] of byListing) {
      void supporterContent.readItem(id).then(async (content) => {
        for (const ref of listingRefs.values()) {
          const layer = supporterLayerOf(content, ref.index);
          if (!alive || !layer) continue;
          const canvas = await unscrambleToCanvas(layer);
          // A rebuild that lands after the next run or after unmount keeps nothing; the next run rebuilds.
          if (!alive) return;
          held.current.set(mascotImageKey(ref), canvas);
          setLayers(new Map(held.current));
        }
      }).catch((cause: unknown) => console.error('Could not draw a Supporter Mascot layer:', cause));
    }
    return () => { alive = false; };
  }, [key]);

  return useCallback((ref) => layers.get(mascotImageKey(ref)) ?? null, [layers]);
}

/** A resolver from a rig image to what draws it, null until it is ready. See `useMascotImageUrls` for the URL kinds. */
export function useMascotImageSources(refs: readonly MascotImageRef[]): (ref: MascotImageRef) => MascotImageSource | null {
  const urlOf = useMascotImageUrls(refs);
  const layerOf = useSupporterLayers(refs);
  return useCallback((ref) => {
    if (ref.kind === 'supporter') {
      const canvas = layerOf(ref);
      return canvas && { kind: 'canvas', canvas };
    }
    const url = urlOf(ref);
    return url === null ? null : { kind: 'url', url };
  }, [urlOf, layerOf]);
}

/** The drawn element of a source: its natural size as `width` and `height` on either kind. */
export type MascotImageElement = HTMLImageElement | HTMLCanvasElement;

/** The pixel size of a drawn source, or zeros before it has any. */
export const naturalSizeOf = (element: MascotImageElement): { width: number; height: number } =>
  (element instanceof HTMLImageElement ? { width: element.naturalWidth, height: element.naturalHeight } : { width: element.width, height: element.height });
