import { useEffect, useState } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { useGameData } from '@/contexts/GameDataContext';
import type { VrmSource } from '@/lib/vrmResolver';

/**
 * An Avatar source as a URL for `VRMViewer.modelUrl`: a library Avatar's object URL, a store entry's embedded
 * file, or `undefined` for the bundled file. A library Avatar that fails to load falls back to the bundled file.
 * `resolving` holds while a library Avatar loads, so a caller can hold a loader instead of the bundled file.
 * It clears when the load settles, failed or not, so a deleted Avatar never leaves the loader spinning.
 */
export function useVrmSourceUrl(source: VrmSource | undefined): { url: string | undefined; resolving: boolean } {
  const { worldOverview } = useGameData();
  const libraryId = source?.kind === 'library' ? source.id : undefined;
  const worldUrl = source?.kind === 'world' ? worldOverview?.vrmStore?.[source.id]?.file.data || undefined : undefined;
  const [libraryUrl, setLibraryUrl] = useState<string | undefined>(undefined);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!libraryId) {
      setLibraryUrl(undefined);
      setResolving(false);
      return;
    }
    let cancelled = false;
    let url: string | undefined;
    setResolving(true);
    // A deleted or malformed model rejects; swallow it so the caller falls back to the bundled default.
    ModelStorageService.getModelData(libraryId).catch(() => null).then((model) => {
      if (cancelled) return;
      if (model) {
        url = URL.createObjectURL(model.blob);
        setLibraryUrl(url);
      }
      setResolving(false); // settled — success or fall-back-to-default, either way no longer resolving
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setLibraryUrl(undefined);
    };
  }, [libraryId]);

  return { url: libraryId ? libraryUrl : worldUrl, resolving };
}
