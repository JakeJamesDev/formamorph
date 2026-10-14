import { useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { AIRequestType } from '@/types';
import { endpointTipLine } from './endpointTip';

export { withEndpointLine } from './endpointTip';

/**
 * Where a request kind will go, as one line for a button's tooltip: "Sends to GLM 5.3 · glm-5.3". Read from
 * the same routing the request itself resolves through, so a prompt pinned to another endpoint names that
 * one, and an unpinned one names the active endpoint.
 */
/** `routes`: a preset's own endpoint ids in place of the kind's route ([] for the active endpoint). */
export function useEndpointTip(): (kind: AIRequestType, routes?: readonly string[]) => string {
  // A surface rendered outside the settings (a test, a dev pane) names nothing rather than failing.
  let settings: Partial<ReturnType<typeof useSettings>> | null;
  // useSettings reads its context on every render before it throws, so the hook order never changes.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  try { settings = useSettings(); } catch { settings = null; }
  const { resolveEndpointForKind, builtinTextEndpointPresets, textEndpointPresets, activeTextEndpointPresetName } = settings ?? {};
  return useCallback((kind: AIRequestType, routes?: readonly string[]) => {
    if (!resolveEndpointForKind) return '';
    const target = resolveEndpointForKind(kind, routes);
    const pinned = target.presetId
      ? [...(builtinTextEndpointPresets ?? []), ...(textEndpointPresets ?? [])].find((p) => p.id === target.presetId)?.name
      : undefined;
    return endpointTipLine(pinned ?? activeTextEndpointPresetName ?? '', target.model ?? '');
  }, [resolveEndpointForKind, builtinTextEndpointPresets, textEndpointPresets, activeTextEndpointPresetName]);
}
