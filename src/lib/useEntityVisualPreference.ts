import { useCallback } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';

/**
 * One entity's picture preference and the setter that changes it, ready to hand to `EntityVisual`.
 * Passing `undefined` as the next value clears the entry, returning that entity to opening on its image.
 */
export function useEntityVisualPreference(entityId?: string) {
  const { entityVisualPreference, setEntityVisualPreference } = useGameplay();

  const onPreferenceChange = useCallback((next: 'model' | 'image' | undefined) => {
    if (!entityId) return;
    setEntityVisualPreference((prev) => {
      const out = { ...prev };
      if (next) out[entityId] = next;
      else delete out[entityId];
      return out;
    });
  }, [entityId, setEntityVisualPreference]);

  return { preference: entityId ? entityVisualPreference[entityId] : undefined, onPreferenceChange };
}
