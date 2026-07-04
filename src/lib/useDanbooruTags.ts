import { useEffect, useState } from 'react';
import { loadDanbooruTags } from './danbooruTags';

/**
 * The shipped Danbooru tag list as autocomplete options, loaded once (the loader is memoized + SFW-gated).
 * `enabled` defers the fetch: pass `true` to load on mount, or a "has been focused" flag to load lazily.
 * Returns [] until loaded (and on the SFW/offline build).
 */
export function useDanbooruTags(enabled = true): string[] {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadDanbooruTags().then((t) => { if (!cancelled) setTags(t); }).catch(() => { /* SFW/offline: none */ });
    return () => { cancelled = true; };
  }, [enabled]);
  return tags;
}
