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
export function useEndpointTip(): (kind: AIRequestType) => string {
  const { describeEndpointForKind } = useSettings();
  return useCallback((kind: AIRequestType) => {
    const { presetName, model } = describeEndpointForKind(kind);
    return endpointTipLine(presetName, model);
  }, [describeEndpointForKind]);
}
