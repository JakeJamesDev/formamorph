import { useMemo } from 'react';
import { visibleLocationImages } from './imageVisibility';
import { useViewedGateInput } from './useViewedGateInput';
import type { Base64Data, GameLocation } from '@/types';

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
