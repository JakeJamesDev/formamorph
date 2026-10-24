import { useCallback } from 'react';
import { readImageAspect } from '@/lib/imageAspect';
import { firstMapFrame, mapImages, withMapImages } from '@/lib/mapBackground';
import { useMountedRef } from '@/lib/useMountedRef';
import type { GalleryImage, GameLocation, MapBackground, MapFrame, WorldOverview } from '@/types';
import { useMediaStep } from './useMediaItemActions';

export interface MapBackgroundData {
  worldOverview: Pick<WorldOverview, 'mapBackground'>;
  updateWorldOverview: (updates: Partial<WorldOverview>) => void;
  locations: GameLocation[];
}

/**
 * Every write to the Map Background. A first image takes its default frame from its own aspect ratio, so it
 * lands once its size is read; `visible` is the canvas's view, used when there are no locations to cover.
 */
export function useMapBackground({ worldOverview, updateWorldOverview, locations }: MapBackgroundData) {
  const mounted = useMountedRef();
  const step = useMediaStep();
  const background = worldOverview.mapBackground;

  const write = useCallback((next: MapBackground | undefined) => updateWorldOverview({ mapBackground: next }), [updateWorldOverview]);

  /** The background holding `images`, with a first frame read from the first image when there is none yet. */
  const resolve = useCallback(async (images: GalleryImage[], visible?: MapFrame | null) => {
    const first = images.find((img) => img.data);
    if (background || !first) return withMapImages(background, images);
    return withMapImages(undefined, images, firstMapFrame(locations, await readImageAspect(first.data), visible));
  }, [background, locations]);

  /** The gallery as the image panel writes it. */
  const setImages = useCallback(async (images: GalleryImage[]) => {
    const next = await resolve(images);
    if (mounted.current) write(next);
  }, [resolve, write, mounted]);

  /** Set Background Image… fills slot 0; Replace swaps it and keeps its rule (Q76). */
  const setPrimary = useCallback(async (data: string, visible?: MapFrame | null) => {
    const [first, ...rest] = mapImages(worldOverview);
    const next = await resolve([{ ...first, data }, ...rest], visible);
    if (mounted.current) await step(first ? 'Replace Image 1: Map Background' : 'Set Map Background', () => write(next));
  }, [worldOverview, resolve, step, write, mounted]);

  /** Remove Image: slot 0 leaves, and the frame and opacity go with the last image (Q77). */
  const removePrimary = useCallback(() =>
    step('Remove Image 1: Map Background', () => write(withMapImages(background, mapImages(worldOverview).slice(1)))),
  [background, worldOverview, step, write]);

  const setFrame = useCallback((frame: MapFrame, label: string) =>
    step(label, () => { if (background) write({ ...background, frame }); }), [background, step, write]);

  /** Live while the slider drags; the slider's own gesture makes one drag one step. */
  const setOpacity = useCallback((opacity: number) => {
    if (background) write({ ...background, opacity });
  }, [background, write]);

  return { background, setImages, setPrimary, removePrimary, setFrame, setOpacity };
}
