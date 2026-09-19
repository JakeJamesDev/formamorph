import { useCallback, useRef, useState } from 'react';
import type { AIRequestType } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { cleanModelNames, loadEndpointModels, type ModelListTarget } from '@/lib/endpointModels';

/**
 * Model names reported by the active endpoint and every endpoint a prompt is routed to. Nothing is fetched
 * until `load` runs; each call refreshes from the per-session cache.
 */
export function useEndpointModelSuggestions(): { suggestions: string[]; load: () => void } {
  const { activeEndpointUrl, activeApiToken, localModelActive, promptEndpoints, resolveEndpointForKind } = useSettings();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const latestRun = useRef(0);

  const load = useCallback(() => {
    const targets: ModelListTarget[] = [{ url: activeEndpointUrl, token: activeApiToken, localEngine: localModelActive }];
    for (const kind of Object.keys(promptEndpoints) as AIRequestType[]) {
      const routed = resolveEndpointForKind(kind);
      targets.push({ url: routed.url, token: routed.apiToken, localEngine: routed.localEngine });
    }
    const run = ++latestRun.current;
    void Promise.all(targets.map((t) => loadEndpointModels(t))).then((lists) => {
      if (run === latestRun.current) setSuggestions(cleanModelNames(lists.flat()));
    });
  }, [activeEndpointUrl, activeApiToken, localModelActive, promptEndpoints, resolveEndpointForKind]);

  return { suggestions, load };
}
