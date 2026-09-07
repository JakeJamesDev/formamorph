import type { EndpointSampler } from '@/lib/endpointSamplers';
import { AiStreamError } from './aiStream';
import type { AiRequestSpec } from './aiRequestSpec';

/** The endpoint setting a failed request proved the server rejected. */
export type RejectedEndpointOverride = EndpointSampler | 'maxOutput';

const OVERRIDE_LABELS: Readonly<Record<RejectedEndpointOverride, string>> = {
  temperature: 'Temperature',
  repetitionPenalty: 'Repetition Penalty',
  topP: 'Top P',
  topK: 'Top K',
  minP: 'Min P',
  maxOutput: 'Max Output',
};

export function rejectedEndpointOverrideLabel(override: RejectedEndpointOverride): string {
  return OVERRIDE_LABELS[override];
}

const SAMPLER_BY_PARAMETER: Readonly<Record<string, EndpointSampler>> = {
  temperature: 'temperature',
  repetition_penalty: 'repetitionPenalty',
  repeat_penalty: 'repetitionPenalty',
  top_p: 'topP',
  top_k: 'topK',
  min_p: 'minP',
};

/**
 * Attribute a structured client-error response to the endpoint override that actually supplied its value.
 * A free-text parameter mention is deliberately not enough evidence to change a saved setting.
 */
export function rejectedEndpointOverride(error: unknown, spec: AiRequestSpec): RejectedEndpointOverride | null {
  if (!(error instanceof AiStreamError) || error.kind !== 'http') return null;
  if (error.status !== 400 && error.status !== 422) return null;
  if (spec.target.localEngine) return null;
  const parameter = error.serverError?.parameter;
  if (!parameter) return null;

  if (parameter === 'max_tokens' || parameter === 'max_completion_tokens') {
    return spec.maxTokensSource === 'endpoint' ? 'maxOutput' : null;
  }
  const sampler = SAMPLER_BY_PARAMETER[parameter];
  return sampler && spec.samplerSources[sampler] === 'endpoint' ? sampler : null;
}
