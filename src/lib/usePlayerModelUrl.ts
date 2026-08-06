import { useEffect, useState } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { useGameData } from '@/contexts/GameDataContext';
import { LEGACY_DEFAULT_AVATAR_SENTINEL } from '@/lib/defaultAvatar';

/**
 * Resolve a `characterData.playerModelId` into a URL for `VRMViewer.modelUrl`.
 * - a model-library id → that model's Blob as an object URL (revoked on change/unmount)
 * - unset / `'world'` → the world's `customPlayerVRM`, else `undefined` (bundled default)
 * - `'default'` → `undefined` (bundled default). `migrateSave` rewrites this sentinel to the seeded model's
 *   id, so it only reaches here from state that hasn't been through a save round-trip.
 *
 * Anything unresolvable — a deleted model, the seeded default among them — falls back to the bundled file,
 * which is why deleting the seeded copy is safe.
 *
 * `resolving` is true only while a library model's blob is being fetched (so a caller can hold a loader
 * instead of transiently mounting the bundled default, which reports default capabilities and can leave the
 * viewer stuck on them). It clears once the fetch settles — including a failed one that falls back to the
 * default — so a deleted model never leaves the loader spinning forever.
 */
export function usePlayerModelUrl(playerModelId?: string): { url: string | undefined; resolving: boolean } {
  const { worldOverview } = useGameData();
  const worldUrl = worldOverview?.customPlayerVRM?.data || undefined;
  const [libraryUrl, setLibraryUrl] = useState<string | undefined>(undefined);
  const [resolving, setResolving] = useState(false);

  const isLibraryId = !!playerModelId
    && playerModelId !== LEGACY_DEFAULT_AVATAR_SENTINEL
    && playerModelId !== 'world';

  useEffect(() => {
    if (!isLibraryId) {
      setLibraryUrl(undefined);
      setResolving(false);
      return;
    }
    let cancelled = false;
    let url: string | undefined;
    setResolving(true);
    // A deleted or malformed model rejects; swallow it so the caller falls back to the bundled default.
    ModelStorageService.getModelData(playerModelId).catch(() => null).then((model) => {
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
  }, [playerModelId, isLibraryId]);

  const url = playerModelId === LEGACY_DEFAULT_AVATAR_SENTINEL ? undefined
    : isLibraryId ? libraryUrl
    : worldUrl;
  return { url, resolving };
}
