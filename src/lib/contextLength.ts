// Best-effort detection of a model's context length (in tokens) from an OpenAI-compatible endpoint.
// The OpenAI spec doesn't include it, but several servers do: LM Studio (`/api/v0/models` →
// loaded_context_length), OpenRouter (`context_length`), llama.cpp (`meta.n_ctx`, `/props`), etc.
// We probe and fall back to manual entry.

import { probeKnownAbsent, recordProbeStatus } from '@/lib/probeMemo';
import type { Codec } from '@/lib/usePersistentState';

/** A detected context length and the `endpoint|model` signature it was read from. */
export interface DetectedContextEntry { sig: string; tokens: number }

/** Stores a detected entry as JSON; any other stored form reads as nothing detected. */
export const detectedContextCodec: Codec<DetectedContextEntry | null> = {
  parse: (raw) => {
    if (raw === '') return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') throw new Error('not a detected entry');
    const { sig, tokens } = value as Record<string, unknown>;
    if (typeof sig !== 'string' || positive(tokens) === null) throw new Error('not a detected entry');
    return { sig, tokens: tokens as number };
  },
  serialize: (value) => (value === null ? '' : JSON.stringify(value)),
};

interface ProbeUrls { openai: string; lmstudio: string; props: string }

/** Derive the model-list and llama.cpp `/props` URLs from a configured chat-completions endpoint. */
export function deriveModelsUrls(endpointUrl: string): ProbeUrls | null {
  try {
    const url = new URL(endpointUrl);
    const openai = endpointUrl.includes('/chat/completions')
      ? endpointUrl.slice(0, endpointUrl.indexOf('/chat/completions')) + '/models'
      : `${url.origin}/v1/models`;
    return { openai, lmstudio: `${url.origin}/api/v0/models`, props: `${url.origin}/props` };
  } catch {
    return null;
  }
}

// Prefer the currently-loaded/effective length (LM Studio's loaded length, vLLM/Aphrodite's
// configured `max_model_len`, llama.cpp's per-slot `meta.n_ctx`); the model's theoretical max
// (`max_context_length`) is the last resort, since servers truncate at the effective length.
// llama.cpp's `meta.n_ctx_train` is a training max and is never read.
const EFFECTIVE_KEYS = ['loaded_context_length', 'context_length', 'context_window', 'max_model_len'] as const;

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Pull a positive context-length number off a single model record, preferring the loaded length. */
function readContextLength(model: unknown): number | null {
  if (!model || typeof model !== 'object') return null;
  const record = model as Record<string, unknown>;
  for (const key of EFFECTIVE_KEYS) {
    const value = positive(record[key]);
    if (value !== null) return value;
  }
  const meta = record.meta;
  const slot = meta && typeof meta === 'object' ? positive((meta as Record<string, unknown>).n_ctx) : null;
  return slot ?? positive(record.max_context_length);
}

/**
 * Extract the context length from a `/v1/models` or `/api/v0/models` response. Prefers the entry
 * whose `id` matches `modelName`, else the first entry that reports a value.
 */
export function parseContextLength(json: unknown, modelName: string): number | null {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return null;

  const match = data.find((m) => (m as { id?: unknown })?.id === modelName);
  const fromMatch = readContextLength(match);
  if (fromMatch !== null) return fromMatch;

  for (const model of data) {
    const value = readContextLength(model);
    if (value !== null) return value;
  }
  return null;
}

/** Extract the per-slot context length from a llama.cpp `/props` response. */
export function parsePropsContextLength(json: unknown): number | null {
  const settings = (json as { default_generation_settings?: unknown })?.default_generation_settings;
  return settings && typeof settings === 'object' ? positive((settings as Record<string, unknown>).n_ctx) : null;
}

/**
 * Query the endpoint for the model's context length (tokens), or null if it can't be determined.
 * Tries LM Studio's native REST API, then the OpenAI-compatible model list, then llama.cpp's
 * `/props`. Never throws.
 */
export async function fetchContextLength(
  endpointUrl: string,
  apiToken: string,
  modelName: string,
): Promise<number | null> {
  const urls = deriveModelsUrls(endpointUrl);
  if (!urls) return null;
  const headers: Record<string, string> = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};

  // LM Studio's native endpoint first — it reports the loaded (currently-set) length; the OpenAI
  // list usually only carries the model's max. `/props` covers llama.cpp builds whose model list
  // has no `meta.n_ctx`. Servers that 404 a path are remembered per session (probeMemo).
  const probes: Array<[string, (json: unknown) => number | null]> = [
    [urls.lmstudio, (json) => parseContextLength(json, modelName)],
    [urls.openai, (json) => parseContextLength(json, modelName)],
    [urls.props, parsePropsContextLength],
  ];
  for (const [url, parse] of probes) {
    if (probeKnownAbsent(url)) continue;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        recordProbeStatus(url, res.status);
        continue;
      }
      const body: unknown = await res.json();
      recordProbeStatus(url, res.status, body);
      const value = parse(body);
      if (value !== null) return value;
    } catch {
      // try the next URL
    }
  }
  return null;
}
