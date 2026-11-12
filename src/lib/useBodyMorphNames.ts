import { useCallback, useEffect, useState } from "react";
import { loadMorphSplit, type MorphSplit } from "./vrmMorphLoader";
import { loadModelMorphNames } from "./modelLoader";
import { useMountedRef } from "./useMountedRef";
import { dataKey, withLibraryModelUrl } from "./useRowModels";
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
  return cachedLoad(id, () => withLibraryModelUrl(id, loadMorphSplit));
}

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
    ? [row.name, await cachedLoad(dataKey("owner", row.model.data), () => ownerSplit(row.model))]
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
 * once the rows resolve, and again when they change. Cached by model.
 */
export function useRowMorphSources(rows: RowModels | undefined): { sources: MorphSource[]; loading: boolean; load: () => void } {
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
