import { useEffect, useState } from 'react';
import { getCatalog } from '@/lib/worldCatalog';
import { collectPromptSuggestions, type RankedName } from '@/lib/promptCatalogSuggestions';

const EMPTY = { tags: [] as string[], modelCounts: [] as RankedName[] };

/**
 * Tag and model suggestions from the prompt listings in the locally cached catalog. Reads the cache each
 * time `enabled` turns on and never fetches; with no cache the lists are empty.
 */
export function usePromptCatalogSuggestions(enabled: boolean): { tags: string[]; modelCounts: RankedName[] } {
  const [suggestions, setSuggestions] = useState(EMPTY);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    getCatalog()
      .then((records) => { if (live) setSuggestions(collectPromptSuggestions(records)); })
      .catch((error: unknown) => console.error('Failed to read the catalog cache:', error));
    return () => { live = false; };
  }, [enabled]);

  return suggestions;
}
