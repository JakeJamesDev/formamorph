/** What the help probes share: the settings snapshot and the summary math. */
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';

export interface ProbeTarget {
  endpoint: string;
  model: string;
  token: string;
}

/** The app's settings against one endpoint. With `tools`, the endpoint takes function calls, so the help session picks lookup mode. */
export function probeSnapshot(target: ProbeTarget, tools = false): AiSettingsSnapshot {
  return {
    resolveTarget: () => ({
      endpointId: 'probe', url: target.endpoint, apiToken: target.token, model: target.model, maxTokens: undefined, localEngine: false,
      samplerOverrides: defaultEndpointSamplerOverrides(),
      reasoning: tools ? { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'probe' } } : UNKNOWN_REASONING_CAPABILITY,
    }),
    thinkingMode: 'off', reasoningEffort: 'auto', reasoningEngaged: false, promptReasoning: {},
    promptReasoningBudget: {}, promptSamplers: {}, promptMaxOutput: {},
    genTemperature: 0.9, genRepetitionPenalty: 1.1, genTopP: 0.95, genTopK: 40, genMinP: 0.05,
    paragraphLimit: 'none', disableThinking: false,
  };
}

/** `n` of `d` as a right-aligned percent, or a dash for none. */
export const pct = (n: number, d: number) => (d === 0 ? '  –' : `${Math.round((100 * n) / d).toString().padStart(3)}%`);

export const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** The share of the keyed facts the answer names, case-insensitive. */
export const factShare = (facts: string[], answer: string) =>
  facts.length ? facts.filter((fact) => answer.toLowerCase().includes(fact.toLowerCase())).length / facts.length : 0;
