import { useEffect, useState } from "react";
import { useGameData } from "@/contexts/GameDataContext";
import { DEFAULT_MODEL_URL } from "./defaultModel";
import { loadBodyMorphNames } from "./vrmMorphLoader";

// Loaded morph names keyed by model URL, so re-selecting stats / re-rendering doesn't reload a model.
const cache = new Map<string, string[]>();

async function cachedLoad(url: string): Promise<string[]> {
  const hit = cache.get(url);
  if (hit) return hit;
  const names = await loadBodyMorphNames(url);
  cache.set(url, names);
  return names;
}

// Custom VRM preferred: use its body morphs if it exposes any; otherwise the default model's.
async function bodyMorphNamesFor(customUrl: string | undefined): Promise<string[]> {
  if (customUrl) {
    const custom = await cachedLoad(customUrl);
    if (custom.length > 0) return custom;
  }
  return cachedLoad(DEFAULT_MODEL_URL);
}

/** Body slider names available to bind in the world editor, resolved from the world's custom VRM
 *  (preferred) or the bundled default model. */
export function useBodyMorphNames(): { names: string[]; loading: boolean } {
  const { worldOverview } = useGameData();
  const customUrl = worldOverview?.customPlayerVRM?.data || undefined;
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bodyMorphNamesFor(customUrl).then((result) => {
      if (cancelled) return;
      setNames(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [customUrl]);

  return { names, loading };
}
