import { useEffect, useState } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { useGameData } from '@/contexts/GameDataContext';
import type { VrmSource } from '@/lib/vrmResolver';

/**
 * An Avatar source as a URL for `VRMViewer.modelUrl`: a library Avatar's object URL, a store entry's embedded
 * file, or `undefined` for none. A library Avatar that fails to load is none too.
 * `resolving` holds while the library list or a library Avatar loads, so a caller can hold a loader.
 * It clears when the load settles, failed or not, so a deleted Avatar never leaves the loader spinning.
 */
export function useVrmSourceUrl(source: VrmSource | undefined): { url: string | undefined; resolving: boolean } {
  const { worldOverview } = useGameData();
  const libraryId = source?.kind === 'library' ? source.id : undefined;
  const worldUrl = source?.kind === 'world' ? worldOverview?.vrmStore?.[source.id]?.file.data || undefined : undefined;
  // The last settled load. A library id it does not name is still loading, from the first render on.
  const [loaded, setLoaded] = useState<{ id: string; url: string | undefined }>();

  useEffect(() => {
    if (!libraryId) return;
    let cancelled = false;
    let url: string | undefined;
    // A deleted or malformed model rejects; swallow it so the caller shows no Avatar.
    ModelStorageService.getModelData(libraryId).catch(() => null).then((model) => {
      if (cancelled) return;
      if (model) url = URL.createObjectURL(model.blob);
      setLoaded({ id: libraryId, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setLoaded(undefined);
    };
  }, [libraryId]);

  const settled = !!libraryId && loaded?.id === libraryId;
  const libraryUrl = settled ? loaded.url : undefined;
  return { url: libraryId ? libraryUrl : worldUrl, resolving: (!!libraryId && !settled) || source?.kind === 'pending' };
}
