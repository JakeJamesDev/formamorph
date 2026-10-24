import { useMemo } from 'react';
import { visibleLocationImages, visibleMapImages } from './imageVisibility';
import { useViewedGateInput } from './useViewedGateInput';
import type { Base64Data, GameLocation, MapFrame, WorldOverview } from '@/types';

/** The picture play paints when there is no current location. */
export const DEFAULT_BACKGROUND = './default-background.jpg';

/**
 * The backdrop for the turn on screen: the location's first visible image in author order, nothing when none
 * passes its rule (Q65), or the default background when there is no location.
 */
export function useLocationBackdrop(location: Pick<GameLocation, 'images'> | null | undefined): Base64Data | undefined {
  const input = useViewedGateInput();
  return useMemo(() => (location ? visibleLocationImages(location, input)[0]?.data : DEFAULT_BACKGROUND), [location, input]);
}

/** What the player's Map draws behind its boxes: the first visible image, in the shared frame (Q74, Q75). */
export interface MapBackdrop {
  data: Base64Data;
  frame: MapFrame;
  opacity: number;
}

/** The Map Background for the turn on screen, or nothing when no image passes its rule. */
export function useMapBackdrop(overview: Pick<WorldOverview, 'mapBackground'>): MapBackdrop | undefined {
  const input = useViewedGateInput();
  const background = overview.mapBackground;
  return useMemo(() => {
    if (!background) return undefined;
    const data = visibleMapImages({ mapBackground: background }, input)[0]?.data;
    return data ? { data, frame: background.frame, opacity: background.opacity } : undefined;
  }, [background, input]);
}
