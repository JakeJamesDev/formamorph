import { useEffect, useState } from 'react';
import { LOCAL_MODELS, repoOf } from './localModels';

// Live all-time download counts for the recommended-model catalog, refreshed from the HF API and cached in
// localStorage for a day. The catalog ships a static `downloads` snapshot per model as the offline fallback;
// this overlays fresher numbers when the network is reachable. Desktop-only (the catalog is desktop-only).

const CACHE_KEY = 'fm.catalogDownloads';
const TTL_MS = 24 * 60 * 60 * 1000;

interface Cache {
  fetchedAt: number;
  counts: Record<string, number>;
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

/** Map of `repoOf(model)` → all-time downloads. Starts from the cached snapshot, then refreshes in the
 *  background if the cache is stale (or missing). On any network failure the last good values are kept, so
 *  callers should fall back to each model's static `downloads`. */
export function useCatalogDownloads(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>(() => readCache()?.counts ?? {});

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return; // fresh enough

    let alive = true;
    const repos = [...new Set(LOCAL_MODELS.map(repoOf))];
    (async () => {
      const results = await Promise.all(
        repos.map(async (repo) => {
          try {
            const res = await fetch(`https://huggingface.co/api/models/${repo}?expand[]=downloadsAllTime`);
            if (!res.ok) return null;
            const json = (await res.json()) as { downloadsAllTime?: number; downloads?: number };
            const n = json.downloadsAllTime ?? json.downloads;
            return typeof n === 'number' ? ([repo, n] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      if (!alive) return;
      const fresh = Object.fromEntries(results.filter((e): e is readonly [string, number] => e !== null));
      if (!Object.keys(fresh).length) return; // all failed (offline) — keep the static snapshot
      const merged = { ...(cached?.counts ?? {}), ...fresh };
      setCounts(merged);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), counts: merged }));
      } catch {
        /* storage full/unavailable — the in-memory value still applies for this session */
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return counts;
}
