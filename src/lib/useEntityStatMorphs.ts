import { useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { entityStatMorphMap } from '@/lib/bodyMorphs';
import type { Entity } from '@/types';

/** The shape keys an entity's own stats drive on its model, for the turn on screen: live, or paged back. */
export function useEntityStatMorphs(entity: Pick<Entity, 'id' | 'stats'> | undefined): Record<string, number> {
  const { viewEntityStats } = useGameplay();
  const values = entity ? viewEntityStats[entity.id] : undefined;
  const authored = entity?.stats;
  return useMemo(() => entityStatMorphMap(values, authored), [values, authored]);
}
