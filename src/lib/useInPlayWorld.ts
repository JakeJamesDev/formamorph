import { useMemo } from 'react';
import { useGameData } from '@/contexts/GameDataContext';
import { useGameplay } from '@/contexts/GameplayContext';
import { playedEntityIdOf, resolveInPlayWorld, type InPlayWorld } from '@/lib/inPlayWorld';

/** The In-Play World for the playthrough in state: the one place a hook below GameViewer takes entity and location verdicts from. */
export function useInPlayWorld(): InPlayWorld {
  const { locations, connections, playEntities } = useGameData();
  const { personaRef } = useGameplay();
  const playedEntityId = playedEntityIdOf(personaRef, playEntities);
  return useMemo(
    () => resolveInPlayWorld({ entities: playEntities, locations, connections }, { playedEntityId }),
    [playEntities, locations, connections, playedEntityId],
  );
}
