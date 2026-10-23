import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { DEFAULT_AVATAR_ID } from "./defaultAvatar";
import { loadBodyMorphNames } from "./vrmMorphLoader";
import { loadModelMorphNames } from "./modelLoader";
import { useMountedRef } from "./useMountedRef";
import ModelStorageService from "@/services/ModelStorageService";
import type { MorphSource } from "./bodyMorphs";
import type { MediaAsset } from "@/types";

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

/** Cache key for an embedded model: its length and both ends of its data URL, so the cache doesn't hold a second
 *  copy of the whole base64 payload. Two files from one exporter share a head; their tails differ. */
const dataKey = (kind: string, dataUrl: string) =>
  `${kind}:${dataUrl.length}:${dataUrl.slice(0, 128)}:${dataUrl.slice(-128)}`;

/** Read the world's embedded custom VRM morphs. */
function morphsForCustom(dataUrl: string): Promise<string[]> {
  return cachedLoad(dataKey("custom", dataUrl), () => loadBodyMorphNames(dataUrl));
}

/** The model an owned stat's body sliders bind to: its owner's own. */
export interface MorphOwner {
  /** Group heading: the owner's name. */
  name: string;
  model?: Partial<MediaAsset>;
}

/**
 * Body slider names an owned stat can bind: the shape keys on its owner's model, across every mesh. No model,
 * or a model with no shape keys, lists none. Lazy and cached like `useBodyMorphSources`.
 */
export function useOwnerMorphSources(owner: MorphOwner | undefined): { sources: MorphSource[]; loading: boolean; load: () => void } {
  const model = owner?.model?.data ? owner.model : undefined;
  const name = owner?.name ?? "";
  const [morphs, setMorphs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  const modelRef = useRef(model);
  modelRef.current = model;
  const mounted = useMountedRef();

  const load = useCallback(() => {
    if (loadedRef.current || !model?.data) return;
    loadedRef.current = true;
    setLoading(true);
    void cachedLoad(dataKey("owner", model.data), () => loadModelMorphNames(model)).then((names) => {
      // A model swapped mid-load leaves this result to a model that's gone.
      if (!mounted.current || modelRef.current !== model) return;
      setMorphs(names);
      setLoading(false);
    });
  }, [model, mounted]);

  // A swapped model invalidates the loaded set; allow a reload on the next picker open.
  useEffect(() => {
    loadedRef.current = false;
    setMorphs([]);
    setLoading(false);
  }, [model]);

  // The heading follows the owner's current name, so a rename after the load shows.
  const sources = useMemo(() => (morphs.length ? [{ heading: name, morphs }] : []), [morphs, name]);
  return { sources, loading, load };
}

/**
 * Body slider names available to bind in the world editor, one group per Avatar: the world's store Avatars
 * first, then the library Avatars with the bundled default leading. Loading is
 * lazy — call `load()` when the picker opens — and cached, so the stat editor stays fast until then.
 *
 * Names are model-agnostic (a binding is the bare morph name); the grouping is display only.
 */
export function useBodyMorphSources(): { sources: MorphSource[]; loading: boolean; load: () => void } {
  // Off world, an owned stat's editor never opens this picker; the hook still runs.
  const overview = useGameDataOptional()?.worldOverview;
  const store = overview?.vrmStore;
  const [sources, setSources] = useState<MorphSource[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  const load = useCallback(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    (async () => {
      const built: MorphSource[] = [];
      // The world's store Avatars lead, one group each under its display name.
      for (const vrm of Object.values(store ?? {})) {
        if (!vrm.file.data) continue;
        const morphs = await morphsForCustom(vrm.file.data);
        if (morphs.length) built.push({ heading: vrm.name, morphs });
      }
      // Library Avatars, newest-first, the bundled default leading: User's Default falls back to it. Loaded
      // one at a time rather than in parallel — VRMs are large, and a burst of concurrent GLTF loads would
      // spike memory; the cache makes this a one-time cost.
      const models = await ModelStorageService.getModelMetadata();
      const ordered = [...models].sort((a, b) => (a.id === DEFAULT_AVATAR_ID ? -1 : b.id === DEFAULT_AVATAR_ID ? 1 : 0));
      for (const model of ordered) {
        const morphs = await morphsForModel(model.id);
        if (morphs.length) built.push({ heading: model.name, morphs });
      }
      setSources(built);
      setLoading(false);
    })();
  }, [store]);

  // A changed store invalidates the loaded set; allow a reload on the next picker open.
  useEffect(() => {
    loadedRef.current = false;
    setSources([]);
  }, [store]);

  return { sources, loading, load };
}
