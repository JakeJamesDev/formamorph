import {
  DEFAULT_GEN_MIN_P,
  DEFAULT_GEN_REPETITION_PENALTY,
  DEFAULT_GEN_TEMPERATURE,
  DEFAULT_GEN_TOP_K,
  DEFAULT_GEN_TOP_P,
  DEFAULT_MAX_TOKENS,
} from '@/contexts/settingsDefaults';

export const ENDPOINT_SAMPLERS = ['temperature', 'repetitionPenalty', 'topP', 'topK', 'minP'] as const;
export type EndpointSampler = typeof ENDPOINT_SAMPLERS[number];

export interface EndpointSamplerOverride {
  enabled: boolean;
  value: number;
}

/** A Formamorph output limit; disabled means no cap is sent to the endpoint. */
export type EndpointMaxOutputOverride = EndpointSamplerOverride;

export type EndpointSamplerOverrides = Record<EndpointSampler, EndpointSamplerOverride>;

const DEFAULT_VALUES: Record<EndpointSampler, number> = {
  temperature: DEFAULT_GEN_TEMPERATURE,
  repetitionPenalty: DEFAULT_GEN_REPETITION_PENALTY,
  topP: DEFAULT_GEN_TOP_P,
  topK: DEFAULT_GEN_TOP_K,
  minP: DEFAULT_GEN_MIN_P,
};

/** New endpoint settings remember the familiar central values without claiming the server uses them. */
export function defaultEndpointSamplerOverrides(): EndpointSamplerOverrides {
  return Object.fromEntries(
    ENDPOINT_SAMPLERS.map((sampler) => [sampler, { enabled: false, value: DEFAULT_VALUES[sampler] }]),
  ) as EndpointSamplerOverrides;
}

/** Formamorph AI starts on its model's published values: Temperature 1.0, Top-p 0.95, Top-k 64, the rest off. */
export function hostedEndpointSamplerOverrides(): EndpointSamplerOverrides {
  return {
    temperature: { enabled: true, value: 1 },
    repetitionPenalty: { enabled: false, value: DEFAULT_GEN_REPETITION_PENALTY },
    topP: { enabled: true, value: 0.95 },
    topK: { enabled: true, value: 64 },
    minP: { enabled: false, value: DEFAULT_GEN_MIN_P },
  };
}

/** Repair a stored override record while preserving valid zero values. A missing sampler takes `defaults`. */
export function coerceEndpointSamplerOverrides(
  raw: unknown,
  defaults: EndpointSamplerOverrides = defaultEndpointSamplerOverrides(),
): EndpointSamplerOverrides {
  const stored = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return Object.fromEntries(ENDPOINT_SAMPLERS.map((sampler) => {
    const value = stored[sampler];
    if (!value || typeof value !== 'object') return [sampler, defaults[sampler]];
    const record = value as Record<string, unknown>;
    return [sampler, {
      enabled: record.enabled === true,
      value: typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : defaults[sampler].value,
    }];
  })) as EndpointSamplerOverrides;
}

/** Existing Formamorph output limits stay enabled when this switch is first introduced. */
export function coerceEndpointMaxOutputOverride(raw: unknown, legacyValue = DEFAULT_MAX_TOKENS): EndpointMaxOutputOverride {
  if (!raw || typeof raw !== 'object') return { enabled: true, value: legacyValue };
  const record = raw as Record<string, unknown>;
  return {
    enabled: record.enabled !== false,
    value: typeof record.value === 'number' && Number.isFinite(record.value) ? record.value : legacyValue,
  };
}
