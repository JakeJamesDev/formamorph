import { useMemo } from 'react';
import { useGameDataOptional } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { liveOpeningKey, type OpeningKey } from '@/lib/drawnOpening';
import type { Entity, GameLocation } from '@/types';

const NONE_LOCATIONS: GameLocation[] = [];
const NONE_ENTITIES: Entity[] = [];

/** The playthrough's Drawn Opening while it still names an Opening in the cast in play, else null. */
export function usePlayOpening(): OpeningKey | null {
  const gameData = useGameDataOptional();
  const worldOverview = gameData?.worldOverview;
  const locations = gameData?.locations ?? NONE_LOCATIONS;
  const playEntities = gameData?.playEntities ?? NONE_ENTITIES;
  const { drawnOpening, discoveredEntities, libraryPersona } = useGameplay();
  return useMemo(() => liveOpeningKey(drawnOpening, {
    overview: worldOverview, locations,
    entities: [...playEntities, ...discoveredEntities.map((d) => d.entity), ...(libraryPersona ? [libraryPersona] : [])],
  }), [drawnOpening, worldOverview, locations, playEntities, discoveredEntities, libraryPersona]);
}
