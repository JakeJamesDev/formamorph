import { useCallback } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { entityImages } from './entityImages';
import type { Entity } from '@/types';

/**
 * One entity's position in its gallery and the way to move it, ready to hand to `EntityVisual`. Held in
 * gameplay state so a panel and the zoom viewer page together and reopening a panel returns to the picture
 * you were on. Session-only: loading a save or starting a game puts every entity back on its primary.
 */
export function useEntityGallery(entity?: Pick<Entity, 'id' | 'images'> | null) {
  const { entityImageIndex, setEntityImageIndex } = useGameplay();
  const id = entity?.id;
  const count = entityImages(entity).length;

  const onImageStep = useCallback(
    (by: number) => {
      if (!id || count < 2) return;
      setEntityImageIndex((prev) => {
        // A stored index outlives the gallery it came from, so start from a clamped one; and the modulo of a
        // negative is negative in JS, so bias before taking it to wrap in both directions.
        const from = Math.min(prev[id] ?? 0, count - 1);
        return { ...prev, [id]: (((from + by) % count) + count) % count };
      });
    },
    [id, count, setEntityImageIndex],
  );

  return { imageIndex: id ? entityImageIndex[id] ?? 0 : 0, onImageStep };
}
