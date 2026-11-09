import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { DEFAULT_AVATAR_ID } from "./defaultAvatar";
import { loadMorphSplit, type MorphSplit } from "./vrmMorphLoader";
import { loadModelMorphNames } from "./modelLoader";
import { useMountedRef } from "./useMountedRef";
import ModelStorageService from "@/services/ModelStorageService";
import type { MorphSource } from "./bodyMorphs";
import type { MediaAsset, VrmPick, WorldVrmStore } from "@/types";

// Morph names cached by a stable key (model id, or the custom VRM's data URL) so re-opening the picker —
// or editing another stat — never reloads a model.
const cache = new Map<string, MorphSplit>();

async function cachedLoad(key: string, load: () => Promise<MorphSplit>): Promise<MorphSplit> {
  const hit = cache.get(key);
  if (hit) return hit;
  const split = await load();
  cache.set(key, split);
  return split;
}

/** Read a library model's body morphs, via a throwaway object URL over its stored blob. */
function morphsForModel(id: string): Promise<MorphSplit> {
  return cachedLoad(id, async () => {
    const { blob } = await ModelStorageService.getModelData(id);
    const url = URL.createObjectURL(blob);
    try {
      return await loadMorphSplit(url);
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
function morphsForCustom(dataUrl: string): Promise<MorphSplit> {
  return cachedLoad(dataKey("custom", dataUrl), () => loadMorphSplit(dataUrl));
}

/** Add a model's sliders as a source; a model with none adds nothing. */
function pushSource(sources: MorphSource[], heading: string, { body, head }: MorphSplit): void {
  if (body.length || head.length) sources.push({ heading, morphs: body, head });
}

/** A non-VRM model has no head catalog, so every key is a body slider. */
async function ownerSplit(model: Partial<MediaAsset>): Promise<MorphSplit> {
  return { body: await loadModelMorphNames(model), head: [] };
}

/** The model an owned stat's body sliders bind to: its owner's own. */
export interface MorphOwner {
  /** Group heading: the owner's name. */
  name: string;
  model?: Partial<MediaAsset>;
  /** The owner's Avatar pick; its sliders and colors count toward the "not on this model" mark. */
  vrmPick?: VrmPick;
}

interface PickedAvatar {
  name: string;
  split: MorphSplit;
}

/** A picked Avatar's display name and sliders; undefined when the pick names no stored model. */
async function avatarSplit(pick: Exclude<VrmPick, { kind: "default" }>, store: WorldVrmStore | undefined): Promise<PickedAvatar | undefined> {
  if (pick.kind === "world") {
    const vrm = store?.[pick.id];
    return vrm?.file.data ? { name: vrm.name, split: await morphsForCustom(vrm.file.data) } : undefined;
  }
  const meta = (await ModelStorageService.getModelMetadata()).find((model) => model.id === pick.id);
  return meta ? { name: meta.name, split: await morphsForModel(pick.id) } : undefined;
}

/**
 * Slider names an owned stat can bind: the shape keys on its owner's 3D model, across every mesh, and the Body
 * Sliders and Head Features of its Avatar. A device-default Avatar pick names no model and adds nothing.
 * Lazy and cached like `useBodyMorphSources`.
 */
export function useOwnerMorphSources(
  owner: MorphOwner | undefined,
): { sources: MorphSource[]; loading: boolean; load: () => void; avatarNamed: boolean } {
  const model = owner?.model?.data ? owner.model : undefined;
  const pick = owner?.vrmPick && owner.vrmPick.kind !== "default" ? owner.vrmPick : undefined;
  const pickKind = pick?.kind;
  const pickId = pick?.id;
  const store = useGameDataOptional()?.worldOverview?.vrmStore;
  const name = owner?.name ?? "";
  const [morphs, setMorphs] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<PickedAvatar>();
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);
  // Each reset starts a new generation; a load from an earlier one is dropped.
  const generation = useRef(0);
  const mounted = useMountedRef();
  // A world pick names a model only when the store holds it.
  const avatarNamed = !!pick && (pick.kind === "library" || !!store?.[pick.id]?.file.data);

  const load = useCallback(() => {
    if (loadedRef.current || (!model?.data && !pick)) return;
    loadedRef.current = true;
    const mine = generation.current;
    setLoading(true);
    void Promise.all([
      model?.data ? cachedLoad(dataKey("owner", model.data), () => ownerSplit(model)) : undefined,
      pick ? avatarSplit(pick, store) : undefined,
    ]).catch(() => [undefined, undefined] as const).then(([own, worn]) => {
      if (!mounted.current || generation.current !== mine) return;
      setMorphs(own?.body ?? []);
      setAvatar(worn);
      setLoading(false);
    });
    // The pick's kind and id name its Avatar; the object around them may be rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, pickKind, pickId, store, mounted]);

  // A swapped model or Avatar invalidates the loaded set; allow a reload on the next picker open.
  useEffect(() => {
    generation.current++;
    loadedRef.current = false;
    setMorphs([]);
    setAvatar(undefined);
    setLoading(false);
  }, [model, pickKind, pickId, store]);

  // The heading follows the owner's current name, so a rename after the load shows.
  const sources = useMemo(() => {
    const built: MorphSource[] = [];
    if (morphs.length) built.push({ heading: name, morphs });
    if (avatar) pushSource(built, avatar.name, avatar.split);
    return built;
  }, [morphs, avatar, name]);
  return { sources, loading, load, avatarNamed };
}

/**
 * Slider names available to bind in the world editor, one source per Avatar: the world's store Avatars
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
        pushSource(built, vrm.name, await morphsForCustom(vrm.file.data));
      }
      // Library Avatars, newest-first, the bundled default leading: User's Default falls back to it. Loaded
      // one at a time rather than in parallel — VRMs are large, and a burst of concurrent GLTF loads would
      // spike memory; the cache makes this a one-time cost.
      const models = await ModelStorageService.getModelMetadata();
      const ordered = [...models].sort((a, b) => (a.id === DEFAULT_AVATAR_ID ? -1 : b.id === DEFAULT_AVATAR_ID ? 1 : 0));
      for (const model of ordered) {
        pushSource(built, model.name, await morphsForModel(model.id));
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
