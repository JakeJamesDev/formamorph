import { useMemo } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import type { AiSettingsSnapshot } from './aiRequestSpec';

/** The settings snapshot the AI Request Spec layer reads, each request kind resolving its own endpoint. */
export function useAiSettingsSnapshot(): AiSettingsSnapshot {
  const {
    resolveEndpointForKind, thinkingMode, reasoningEffort, reasoningEngaged, promptReasoning,
    promptReasoningSettings, nativeReasoning, promptReasoningBudget, promptSamplers, promptMaxOutput,
    genTemperature, genRepetitionPenalty, genTopP, genTopK, genMinP, paragraphLimit, disableThinking,
  } = useSettings();
  return useMemo(() => ({
    resolveTarget: resolveEndpointForKind,
    thinkingMode,
    reasoningEffort,
    reasoningEngaged,
    promptReasoning,
    // The stored switches and strengths, which the spec layer reads only on an endpoint that refuses off.
    keptReasoning: { prompts: promptReasoningSettings, global: nativeReasoning },
    promptReasoningBudget,
    promptSamplers,
    promptMaxOutput,
    genTemperature,
    genRepetitionPenalty,
    genTopP,
    genTopK,
    genMinP,
    paragraphLimit,
    disableThinking,
  }), [
    resolveEndpointForKind, thinkingMode, reasoningEffort, reasoningEngaged, promptReasoning,
    promptReasoningSettings, nativeReasoning, promptReasoningBudget, promptSamplers, promptMaxOutput,
    genTemperature, genRepetitionPenalty, genTopP, genTopK, genMinP, paragraphLimit, disableThinking,
  ]);
}
