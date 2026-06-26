import { useCallback, useEffect, useState } from 'react';
import { getCatalog, replaceCatalog } from './worldCatalog';
import { collectSanitizedTags } from './tagUtils';
import WorldStorageService from '@/services/WorldStorageService';

/**
 * Tag suggestions for the world-editor autocomplete: the unique, sanitized tags from the cached
 * Discover catalog (same source as the world browser's tag filter). `refresh()` re-syncs the catalog
 * from the server in the background; the cache also auto-syncs once on mount when it's empty.
 */
export function useCatalogTags(): { tags: string[]; refresh: () => Promise<void>; refreshing: boolean } {
  const [tags, setTags] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await WorldStorageService.fetchRemoteWorlds(1, 1000, '', false, false);
      if (result.success && Array.isArray(result.data)) {
        await replaceCatalog(result.data);
        setTags(collectSanitizedTags(result.data.map((w) => w.tags)));
      }
    } catch {
      // Keep whatever tags we already have on a failed sync.
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((worlds) => {
        if (cancelled) return;
        setTags(collectSanitizedTags(worlds.map((w) => w.tags as string[] | undefined)));
        if (worlds.length === 0) refresh(); // no cache yet → pull one in the background
      })
      .catch(() => { if (!cancelled) setTags([]); });
    return () => { cancelled = true; };
  }, [refresh]);

  return { tags, refresh, refreshing };
}
