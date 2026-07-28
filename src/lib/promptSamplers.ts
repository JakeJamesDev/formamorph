import type { AIRequestType } from '@/types';
import type { Codec } from './usePersistentState';

/** The per-prompt sampler settings the tuner can override, on top of the global sliders. */
export type PromptSampler = 'temperature' | 'repetitionPenalty';

// Per-prompt pinned sampler values, independent of the creative global sliders. Extraction/routing/compression
// prompts pin a low, near-deterministic temperature. The planning ('thinking') prompt is the exception,
// tuned empirically against 12B/24B local models (see [[test-models]]): it wants a MODERATE temperature -
// its greedy default is to narrow the cast to whoever the action engages, so it needs entropy to keep the
// whole scene - and a repetition penalty of 1 (a penalty > 1 suppresses the near-identical cast bullets,
// dropping characters and driving invented ones). A sampler absent for a kind follows the global fallback.
export const PROMPT_SAMPLER_PINS: Partial<Record<AIRequestType, Partial<Record<PromptSampler, number>>>> = {
  statUpdates: { temperature: 0.2 },
  locationChange: { temperature: 0.15 },
  summary: { temperature: 0 },
  milestoneSelect: { temperature: 0 },
  timePassed: { temperature: 0 },
  openingTime: { temperature: 0 },
  // The tag pass names what a scene shows. Not an extraction (0 gives the same five flat tags for any
  // action) and not creative writing either, so it sits low but non-zero.
  sceneTags: { temperature: 0.3 },
  thinking: { temperature: 0.4, repetitionPenalty: 1 },
};

export interface PromptSamplerSetting {
  /** When false the prompt uses the sampler's default; when true `value` overrides it. */
  custom: boolean;
  /** The custom value, preserved across toggling so turning custom off never discards it. */
  value: number;
}

/** Per-request-type sampler overrides, keyed `kind -> sampler -> setting`. A kind/sampler with no entry (or
 *  `custom` false) resolves to its default; the whole map persists as one localStorage record. */
export type PromptSamplerMap = Partial<Record<AIRequestType, Partial<Record<PromptSampler, PromptSamplerSetting>>>>;

/** The value to send for a sampler when Custom is off, or `undefined` to omit the field entirely so the
 *  endpoint's own value applies. A pinned prompt always sends its constant; every other prompt sends the
 *  global slider value on the built-in engine (its only "endpoint setting") but omits on a custom endpoint,
 *  leaving LM Studio/Ollama to use the model's configured value (see [[endpoint-temperature-behavior]]). */
export function defaultPromptSampler(kind: AIRequestType, sampler: PromptSampler, globalValue: number, isBuiltIn: boolean): number | undefined {
  const pinned = PROMPT_SAMPLER_PINS[kind]?.[sampler];
  if (pinned !== undefined) return pinned;
  return isBuiltIn ? globalValue : undefined;
}

/** The value actually sent for a prompt's sampler: its custom value when enabled, otherwise the default.
 *  `undefined` means send no field at all. */
export function resolvePromptSampler(kind: AIRequestType, sampler: PromptSampler, map: PromptSamplerMap, globalValue: number, isBuiltIn: boolean): number | undefined {
  const setting = map[kind]?.[sampler];
  return setting?.custom ? setting.value : defaultPromptSampler(kind, sampler, globalValue, isBuiltIn);
}

/** localStorage codec for the override map. Tolerates malformed/absent storage by falling back to an empty
 *  map (every kind then resolves to its default). */
export const promptSamplerMapCodec: Codec<PromptSamplerMap> = {
  parse: (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as PromptSamplerMap) : {};
    } catch {
      return {};
    }
  },
  serialize: (v) => JSON.stringify(v),
};
