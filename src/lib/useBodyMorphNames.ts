import { useCallback, useEffect, useRef, useState } from "react";
import { useGameData } from "@/contexts/GameDataContext";
import { DEFAULT_MODEL_ID } from "./defaultModel";
import { loadBodyMorphNames } from "./vrmMorphLoader";
import ModelStorageService from "@/services/ModelStorageService";
import type { MorphSource } from "./bodyMorphs";

// Morph names cached by a stable key (model id, or the custom VRM's data URL) so re-opening the picker —
// or editing another stat — never reloads a model.
const cache = new Map<string, string[]>();

async function cachedLoad(key: string, load: () => Promise<string[]>): Promise<string[]> {
  const hit = cache.get(key);
  if (hit) return hit;
  const names = await load();
  cache.set(key, names);
  return names;
}

/** Read a library model's body morphs, via a throwaway object URL over its stored blob. */
function morphsForModel(id: string): Promise<string[]> {
  return cachedLoad(id, async () => {
    const { blob } = await ModelStorageService.getModelData(id);
    const url = URL.createObjectURL(blob);
    try {
      return await loadBodyMorphNames(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  });
}

/** Read the world's embedded custom VRM morphs. Keyed by a short slice of the data URL so the cache
 *  doesn't hold a second copy of the whole base64 payload. */
function morphsForCustom(dataUrl: string): Promise<string[]> {
  return cachedLoad(`custom:${dataUrl.length}:${dataUrl.slice(0, 128)}`, () => loadBodyMorphNames(dataUrl));
}

/**
 * Body slider names available to bind in the world editor, one group per model: the world's own model
 * first (its embedded custom VRM, else the bundled default), then every other library model. Loading is
 * lazy — call `load()` when the picker opens — and cached, so the stat editor stays fast until then.
 *
 * Names are model-agnostic (a binding is the bare morph name); the grouping is display only.
 */
export function useBodyMorphSources(): { sources: MorphSource[]; loading: boolean; load: () => void } {
  const { worldOverview } = useGameData();
  const customUrl = worldOverview?.customPlayerVRM?.data || undefined;
  const [sources, setSources] = useState<MorphSource[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    (async () => {
      const built: MorphSource[] = [];
      // The world's own model leads: a custom VRM if it has one.
      if (customUrl) {
        const morphs = await morphsForCustom(customUrl);
        if (morphs.length) built.push({ heading: "This World's Model", morphs });
      }
      // Library models, newest-first. With no custom VRM the world wears the bundled default, so lead with
      // it. Loaded one at a time rather than in parallel — VRMs are large, and a burst of concurrent
      // GLTF loads would spike memory; the cache makes this a one-time cost.
      const models = await ModelStorageService.getModelMetadata();
      const ordered = customUrl
        ? models
        : [...models].sort((a, b) => (a.id === DEFAULT_MODEL_ID ? -1 : b.id === DEFAULT_MODEL_ID ? 1 : 0));
      for (const model of ordered) {
        const morphs = await morphsForModel(model.id);
        if (morphs.length) built.push({ heading: model.name, morphs });
      }
      setSources(built);
      setLoading(false);
    })();
  }, [customUrl]);

  // A changed custom VRM invalidates the loaded set; allow a reload on the next picker open.
  useEffect(() => {
    loadedRef.current = false;
    setSources([]);
  }, [customUrl]);

  return { sources, loading, load };
}
