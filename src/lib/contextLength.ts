// Best-effort detection of a model's context length (in tokens) from an OpenAI-compatible endpoint.
// The OpenAI spec doesn't include it, but several servers do: LM Studio (`/api/v0/models` →
// loaded_context_length), OpenRouter (`context_length`), etc. We probe and fall back to manual entry.

/** Derive the model-list URLs from a configured chat-completions endpoint. */
export function deriveModelsUrls(endpointUrl: string): { openai: string; lmstudio: string } | null {
  try {
    const url = new URL(endpointUrl);
    const openai = endpointUrl.includes('/chat/completions')
      ? endpointUrl.slice(0, endpointUrl.indexOf('/chat/completions')) + '/models'
      : `${url.origin}/v1/models`;
    return { openai, lmstudio: `${url.origin}/api/v0/models` };
  } catch {
    return null;
  }
}

// Prefer the currently-loaded/effective length (LM Studio's loaded length, vLLM/Aphrodite's
// configured `max_model_len`); the model's theoretical max (`max_context_length`) is the last resort,
// since servers truncate at the effective length and the max would over-state the budget.
const CONTEXT_KEYS = ['loaded_context_length', 'context_length', 'context_window', 'max_model_len', 'max_context_length'] as const;

/** Pull a positive context-length number off a single model record, preferring the loaded length. */
function readContextLength(model: unknown): number | null {
  if (!model || typeof model !== 'object') return null;
  const record = model as Record<string, unknown>;
  for (const key of CONTEXT_KEYS) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return null;
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

/**
 * Query the endpoint for the model's context length (tokens), or null if it can't be determined.
 * Tries the OpenAI-compatible model list first, then LM Studio's native REST API. Never throws.
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
  // list usually only carries the model's max. Non-LM-Studio servers 404 the native path and fall through.
  for (const url of [urls.lmstudio, urls.openai]) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const value = parseContextLength(await res.json(), modelName);
      if (value !== null) return value;
    } catch {
      // try the next URL
    }
  }
  return null;
}
