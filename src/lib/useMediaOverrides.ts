import { useMemo } from 'react';
import { useGameplayOptional } from '@/contexts/GameplayContext';
import { mediaOverrideReader, personaEntityId, type MediaOverrideReader } from './mediaOverrides';
import { useMediaList } from './useMediaList';

/** The script overrides of the turn on screen, live or paged back; none outside a game. */
export function useViewedMediaOverrides(): MediaOverrideReader {
  const play = useGameplayOptional();
  const media = useMediaList();
  const overrides = play?.viewMediaOverrides;
  const genericStates = play?.viewGenericStates;
  const locationId = play?.viewLocationId;
  const personaId = personaEntityId(play?.personaRef);
  return useMemo(
    () => mediaOverrideReader(overrides, media, { genericStates, locationId, personaId }),
    [overrides, media, genericStates, locationId, personaId],
  );
}
