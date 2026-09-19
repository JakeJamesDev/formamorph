import { useEffect, useRef, useState } from 'react';
import { getCatalog } from '@/lib/worldCatalog';
import { collectPromptSuggestions, type RankedName } from '@/lib/promptCatalogSuggestions';

const EMPTY = { tags: [] as string[], modelCounts: [] as RankedName[] };

/**
 * Tag and model suggestions from the prompt listings in the locally cached catalog. Reads the cache the first
 * time `enabled` turns on and never fetches; with no cache the lists stay empty.
 */
export function usePromptCatalogSuggestions(enabled: boolean): { tags: string[]; modelCounts: RankedName[] } {
  const [suggestions, setSuggestions] = useState(EMPTY);
  const started = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    getCatalog()
      .then((records) => { if (mounted.current) setSuggestions(collectPromptSuggestions(records)); })
      .catch((error: unknown) => console.error('Failed to read the catalog cache:', error));
  }, [enabled]);

  return suggestions;
}
