import { useCallback, useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { visibleImages } from './imageVisibility';
import { useViewedGateInput } from './useViewedGateInput';
import type { Entity } from '@/types';

/**
 * One entity's visible images on the turn on screen, its position among them, and the way to move it, ready to
 * hand to `EntityVisual`. The stored index is an author-order slot held in gameplay state, so a panel and the
 * zoom viewer page together and reopening a panel returns to the image you were on. Session-only.
 */
export function useEntityGallery(entity?: Pick<Entity, 'id' | 'images'> | null) {
  const { entityImageIndex, setEntityImageIndex } = useGameplay();
  const input = useViewedGateInput();
  const visible = useMemo(() => (entity ? visibleImages(entity, input) : []), [entity, input]);
  const images = useMemo(() => visible.map((img) => img.data), [visible]);
  const id = entity?.id;
  const positionOf = useCallback((slot: number | undefined) => Math.max(0, visible.findIndex((img) => img.slot === slot)), [visible]);

  const onImageStep = useCallback(
    (by: number) => {
      if (!id || visible.length < 2) return;
      const count = visible.length;
      setEntityImageIndex((prev) => {
        // The modulo of a negative is negative in JS, so bias before taking it to wrap in both directions.
        const to = (((positionOf(prev[id]) + by) % count) + count) % count;
        return { ...prev, [id]: visible[to].slot };
      });
    },
    [id, visible, positionOf, setEntityImageIndex],
  );

  return { images, imageIndex: id ? positionOf(entityImageIndex[id]) : 0, onImageStep };
}
