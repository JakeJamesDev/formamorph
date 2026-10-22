import { useEffect, useState } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { useGameData } from '@/contexts/GameDataContext';
import type { VrmSource } from '@/lib/vrmResolver';

/**
 * Resolve an Avatar source into a URL for `VRMViewer.modelUrl`.
 * - a library id → that model's Blob as an object URL (revoked on change/unmount)
 * - a world store id → the store entry's embedded file
 * - the bundled file, or no source → `undefined` (VRMViewer's bundled default)
 *
 * A library model that fails to load falls back to the bundled file, which is why deleting the seeded copy
 * is safe.
 *
 * `resolving` is true only while a library model's blob is being fetched (so a caller can hold a loader
 * instead of transiently mounting the bundled default, which reports default capabilities and can leave the
 * viewer stuck on them). It clears once the fetch settles — including a failed one that falls back to the
 * default — so a deleted model never leaves the loader spinning forever.
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
