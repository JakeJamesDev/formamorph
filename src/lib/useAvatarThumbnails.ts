import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { toastError } from '@/lib/linkToast';
import { useMountedRef } from '@/lib/useMountedRef';
import type { AvatarThumbnailSource, ModelMetadata } from '@/types';

/**
 * Keep the Avatar grid's cards filled in, and switch one card's thumbnail source.
 *
 * @param models - The grid state
 * @param setModels - The grid state's setter; each result lands on its Avatar's entry
 * @param active - Whether the Avatar tab is showing, so the backfill waits until it is
 * @returns The switch handler for the tile menu
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

  // Backfill one card at a time, so a grid of new Avatars never holds several WebGL contexts at once. A card
  // whose render fails is marked in storage, so this settles rather than retrying every visit.
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
    // Keyed on the id set: a landing card changes `models` but not the ids, so the loop isn't torn down and
    // restarted. It re-runs only when an Avatar is added or removed.
  }, [active, models.map((m) => m.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback(async (id: string, source: AvatarThumbnailSource) => {
    try {
      const card = await ModelStorageService.setThumbnailSource(id, source);
      if (card && mounted.current) replace(card);
    } catch (error) {
      if (mounted.current) toastError(error, { headline: "Couldn't generate the thumbnail." });
    }
  }, [mounted, replace]);
}
