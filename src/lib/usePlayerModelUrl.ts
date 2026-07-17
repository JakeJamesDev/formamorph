import { useEffect, useState } from 'react';
import ModelStorageService from '@/services/ModelStorageService';
import { useGameData } from '@/contexts/GameDataContext';
import { LEGACY_DEFAULT_MODEL_SENTINEL } from '@/lib/defaultModel';

/**
 * Resolve a `characterData.playerModelId` into a URL for `VRMViewer.modelUrl`.
 * - a model-library id → that model's Blob as an object URL (revoked on change/unmount)
 * - unset / `'world'` → the world's `customPlayerVRM`, else `undefined` (bundled default)
 * - `'default'` → `undefined` (bundled default). `migrateSave` rewrites this sentinel to the seeded model's
 *   id, so it only reaches here from state that hasn't been through a save round-trip.
 *
 * Anything unresolvable — a deleted model, the seeded default among them — falls back to the bundled file,
 * which is why deleting the seeded copy is safe.
 */
export function usePlayerModelUrl(playerModelId?: string): string | undefined {
  const { worldOverview } = useGameData();
  const worldUrl = worldOverview?.customPlayerVRM?.data || undefined;
  const [libraryUrl, setLibraryUrl] = useState<string | undefined>(undefined);

  const isLibraryId = !!playerModelId
    && playerModelId !== LEGACY_DEFAULT_MODEL_SENTINEL
    && playerModelId !== 'world';

  useEffect(() => {
    if (!isLibraryId) {
      setLibraryUrl(undefined);
      return;
    }
    let cancelled = false;
    let url: string | undefined;
    // A deleted or malformed model rejects; swallow it so the caller falls back to the bundled default.
    ModelStorageService.getModelData(playerModelId).catch(() => null).then((model) => {
      if (cancelled || !model) return;
      url = URL.createObjectURL(model.blob);
      setLibraryUrl(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setLibraryUrl(undefined);
    };
  }, [playerModelId, isLibraryId]);

  if (playerModelId === LEGACY_DEFAULT_MODEL_SENTINEL) return undefined;
  if (isLibraryId) return libraryUrl;
  return worldUrl;
}
