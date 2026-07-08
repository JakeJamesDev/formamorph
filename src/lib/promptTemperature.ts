import type { AIRequestType } from '@/types';
import type { Codec } from './usePersistentState';

// Prompts whose job is extraction, routing, or compression want near-deterministic sampling, independent of
// the creative global temperature. Every other request type defaults to the global temperature slider; a
// kind absent from this map falls through to it.
export const DETERMINISTIC_PROMPT_TEMPS: Partial<Record<AIRequestType, number>> = {
  statUpdates: 0.2,
  locationChange: 0.15,
  summary: 0.3,
};

export interface PromptTempSetting {
  /** When false the prompt uses its kind default; when true `value` overrides it. */
  custom: boolean;
  /** The custom value, preserved across toggling so turning custom off never discards it. */
  value: number;
}

/** Per-request-type temperature overrides, keyed by `AIRequestType`. A kind with no entry (or `custom`
 *  false) resolves to its default; entries persist as one localStorage record. */
export type PromptTempMap = Partial<Record<AIRequestType, PromptTempSetting>>;

/** The temperature to send when Custom Temperature is off, or `undefined` to omit the field entirely so the
 *  endpoint's own value applies. Deterministic prompts always send their low constant. Every other prompt
 *  sends the global temperature on the built-in engine (its only "endpoint setting") but omits on a custom
 *  endpoint, leaving LM Studio/Ollama to use the model's configured temperature (see [[endpoint-temperature-behavior]]). */
export function defaultPromptTemperature(kind: AIRequestType, globalTemp: number, isBuiltIn: boolean): number | undefined {
  const pinned = DETERMINISTIC_PROMPT_TEMPS[kind];
  if (pinned !== undefined) return pinned;
  return isBuiltIn ? globalTemp : undefined;
}

/** The temperature actually sent for a prompt: its custom value when enabled, otherwise the kind default.
 *  `undefined` means send no `temperature` field at all. */
export function resolvePromptTemperature(kind: AIRequestType, map: PromptTempMap, globalTemp: number, isBuiltIn: boolean): number | undefined {
  const setting = map[kind];
  return setting?.custom ? setting.value : defaultPromptTemperature(kind, globalTemp, isBuiltIn);
}

/** localStorage codec for the override map. Tolerates malformed/absent storage by falling back to an empty
 *  map (every kind then resolves to its default). */
export const promptTempMapCodec: Codec<PromptTempMap> = {
  parse: (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as PromptTempMap) : {};
    } catch {
      return {};
    }
  },
  serialize: (v) => JSON.stringify(v),
};
