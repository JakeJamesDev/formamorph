import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { toastError } from '@/lib/linkToast';
import { useMountedRef } from '@/lib/useMountedRef';
import type { AvatarThumbnailSource, ModelMetadata } from '@/types';

/**
 * Keep the Avatar grid's cards filled in while `active`, and return the tile menu's thumbnail switch. Each
 * result lands on its Avatar's entry in the grid state.
 */
export function useAvatarThumbnails(
  models: ModelMetadata[],
  setModels: Dispatch<SetStateAction<ModelMetadata[]>>,
  active: boolean,
): (id: string, source: AvatarThumbnailSource) => Promise<void> {
  const mounted = useMountedRef();
  const replace = useCallback((card: ModelMetadata) => {
    setModels((prev) => prev.map((m) => (m.id === card.id ? card : m)));
  }, [setModels]);

  // One card at a time, so the grid never holds several WebGL contexts; storage marks failed renders.
  useEffect(() => {
    if (!active) return;
    const pending = models.filter((model) => !model.thumbnail || model.hasFileThumbnail === undefined);
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const model of pending) {
        if (cancelled) return;
        const card = await ModelStorageService.ensureCard(model.id);
        if (cancelled || !card) continue;
        replace(card);
      }
    })();
    return () => { cancelled = true; };
    // Keyed on the id set, so a landing card doesn't restart the loop.
  }, [active, models.map((m) => m.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback(async (id: string, source: AvatarThumbnailSource) => {
    try {
      const card = await ModelStorageService.setThumbnailSource(id, source);
      if (card && mounted.current) replace(card);
    } catch (error) {
      const headline = source === 'generated' ? "Couldn't generate the thumbnail." : "Couldn't change the thumbnail.";
      if (mounted.current) toastError(error, { headline });
    }
  }, [mounted, replace]);
}
