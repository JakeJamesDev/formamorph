import { useEffect, useMemo, useState } from 'react';
import type { DocSection } from '@/lib/docs/docsIndex';
import type { Guide } from '@/lib/formaquestion/guide';
import { guideSearch } from '@/lib/formaquestion/helpSession';
import { isSearchable } from './formaquestionTabs';

/** The pause in typing after which the Search tab ranks by meaning. */
export const SEMANTIC_PAUSE_MS = 300;

/** One finished merged search, for the guide and text it searched. */
interface MergedResults {
  guide: Guide;
  text: string;
  results: DocSection[];
}

/**
 * The Search tab's results for the trimmed text. The keyword results show at once. With Semantic Search on,
 * the merged results replace them after a pause in typing; a result for older text never shows.
 */
export function useGuideSearch(guide: Guide, text: string, semantic: boolean, limit: number): DocSection[] {
  const searchable = isSearchable(text);
  const keyword = useMemo(() => (searchable ? guide.index.search(text, limit) : []), [guide, text, searchable, limit]);
  const [merged, setMerged] = useState<MergedResults | null>(null);

  useEffect(() => {
    if (!semantic || !searchable) return;
    // Cleared by a text change and at unmount, so a late search writes nothing.
    let current = true;
    const timer = setTimeout(() => {
      // A failed search keeps the keyword results.
      void guideSearch(guide.index, text, { semantic: true, limit }).then((results) => {
        if (current) setMerged({ guide, text, results });
      }, () => {});
    }, SEMANTIC_PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [guide, text, semantic, searchable, limit]);

  return semantic && merged?.guide === guide && merged.text === text ? merged.results : keyword;
}
