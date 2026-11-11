import { useCallback, useEffect, useRef, useState } from "react";
import { useGameDataOptional } from "@/contexts/GameDataContext";
import { DEFAULT_AVATAR_ID } from "./defaultAvatar";
import { loadMorphSplit, type MorphSplit } from "./vrmMorphLoader";
import { loadModelMorphNames } from "./modelLoader";
import { useMountedRef } from "./useMountedRef";
import ModelStorageService from "@/services/ModelStorageService";
import type { MorphSource } from "./bodyMorphs";
import type { RowModel, RowModels } from "./useRowModels";
import type { MediaAsset } from "@/types";

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

/** A row model's sliders under its heading; undefined when it has none. */
async function rowModelSource(row: RowModel): Promise<MorphSource | undefined> {
  const [heading, split] = row.kind === "model"
    ? [row.heading, await cachedLoad(dataKey("owner", row.model.data), () => ownerSplit(row.model))]
    : row.kind === "world"
      ? [row.name, await morphsForCustom(row.data)]
      : [row.name, await morphsForModel(row.id)];
  const built: MorphSource[] = [];
  pushSource(built, heading, split);
  return built[0];
}

const NO_SOURCES: MorphSource[] = [];

/**
 * Slider names an owned stat can bind: the shape keys on each model of `rows`, the owner's 3D model across
 * every mesh, and the Body Sliders and Head Features of its resolved Avatar. Loads after the first `load()`,
 * once the rows resolve, and again when they change. Cached like `useBodyMorphSources`.
 */
export function useOwnerMorphSources(rows: RowModels | undefined): { sources: MorphSource[]; loading: boolean; load: () => void } {
  const [loaded, setLoaded] = useState<{ rows: RowModels; sources: MorphSource[] }>();
  const [wanted, setWanted] = useState(false);
  const mounted = useMountedRef();
  const load = useCallback(() => setWanted(true), []);
  const ready = wanted && !!rows && !rows.resolving;

  useEffect(() => {
    if (!ready || !rows || loaded?.rows === rows) return;
    let current = true;
    // Each model fails alone, so a broken Avatar keeps the 3D model's sliders.
    void Promise.all(rows.models.map((row) => rowModelSource(row).catch(() => undefined))).then((found) => {
      if (current && mounted.current) setLoaded({ rows, sources: found.filter((s): s is MorphSource => !!s) });
    });
    return () => { current = false; };
  }, [ready, rows, loaded, mounted]);

  // Sources of earlier rows never show, so a rename or a new pick reads fresh.
  const fresh = !!loaded && loaded.rows === rows;
  return { sources: fresh ? loaded.sources : NO_SOURCES, loading: wanted && !fresh, load };
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
