import { useMemo } from 'react';
import { visibleLocationImages, visibleMapImages } from './imageVisibility';
import type { Picture } from './layeredImages';
import { maskEntry } from './weatherMask';
import { useViewedGateInput } from './useViewedGateInput';
import { useMediaList } from './useMediaList';
import { useViewedMediaOverrides } from './useMediaOverrides';
import type { Base64Data, GameLocation, MapFrame, WorldOverview } from '@/types';

/** The picture play paints when there is no current location. */
export const DEFAULT_BACKGROUND = './default-background.jpg';

/** The location art on screen and the Weather Mask that limits the weather over it. */
export interface LocationBackdropView {
  picture: Picture | undefined;
  /** The shown slot's Mask entry data, or undefined for no slot mask or a missing entry. */
  mask: string | undefined;
}

/**
 * The backdrop for the turn on screen: the location's first visible picture in author order, nothing when none
 * passes its rule (Q65), or the default background when there is no location.
 */
export function useLocationBackdrop(location: Pick<GameLocation, 'id' | 'images'> | null | undefined): LocationBackdropView {
  const input = useViewedGateInput();
  const media = useMediaList();
  const overrides = useViewedMediaOverrides();
  return useMemo(() => {
    if (!location) return { picture: DEFAULT_BACKGROUND, mask: undefined };
    const shown = visibleLocationImages(location, input, media, overrides.locationPicture(location.id))[0];
    return { picture: shown?.data, mask: shown && maskEntry(media, shown.weatherMask)?.data };
  }, [location, input, media, overrides]);
}

/** What the player's Map draws behind its boxes: the first visible image, in the shared frame (Q74, Q75). */
export interface MapBackdrop {
  data: Base64Data;
  frame: MapFrame;
  opacity: number;
}

/** The Map Background for the turn on screen, or nothing when no image passes its rule. */
export function useMapBackdrop(overview: Pick<WorldOverview, 'mapBackground' | 'mediaList'>): MapBackdrop | undefined {
  const input = useViewedGateInput();
  const background = overview.mapBackground;
  return useMemo(() => {
    if (!background) return undefined;
    const data = visibleMapImages({ mapBackground: background, mediaList: overview.mediaList }, input)[0]?.data;
    return data ? { data, frame: background.frame, opacity: background.opacity } : undefined;
  }, [background, overview.mediaList, input]);
}
