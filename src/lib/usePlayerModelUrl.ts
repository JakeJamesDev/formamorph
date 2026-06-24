import { useEffect, useState } from 'react';
import { getModel } from './modelLibrary';
import { useGameData } from '@/contexts/GameDataContext';

/**
 * Resolve a `characterData.playerModelId` into a URL for `VRMViewer.modelUrl`.
 * - a model-library id → that model's Blob as an object URL (revoked on change/unmount)
 * - `'default'` → `undefined` (VRMViewer falls back to the bundled model)
 * - unset / `'world'` → the world's `customPlayerVRM`, else `undefined` (bundled default)
 * A library id that no longer exists falls back to the bundled default.
 */
export function usePlayerModelUrl(playerModelId?: string): string | undefined {
  const { worldOverview } = useGameData();
  const worldUrl = worldOverview?.customPlayerVRM?.data || undefined;
  const [libraryUrl, setLibraryUrl] = useState<string | undefined>(undefined);

  const isLibraryId = !!playerModelId && playerModelId !== 'default' && playerModelId !== 'world';

  useEffect(() => {
    if (!isLibraryId) {
      setLibraryUrl(undefined);
      return;
    }
    let cancelled = false;
    let url: string | undefined;
    getModel(playerModelId).then((model) => {
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

  if (playerModelId === 'default') return undefined;
  if (isLibraryId) return libraryUrl;
  return worldUrl;
}
