import { deriveModelsUrls } from '@/lib/contextLength';
import { probeKnownAbsent, recordProbeStatus } from '@/lib/probeMemo';
import { recordServedModel } from '@/lib/servedModel';

/** Outcome of a single endpoint probe. `unknownModel` is a *reachable* server we still can't play on. */
export type EndpointProbe = 'ok' | 'unreachable' | 'unknownModel';

/** A text probe's outcome, plus the model the server really runs where it names one. */
export interface TextEndpointProbe {
  outcome: EndpointProbe;
  /** The single loaded model's id, or null where the server names none. */
  served: string | null;
}

interface ModelRow { id?: unknown; state?: unknown; type?: unknown }

/** The rows of an OpenAI `/v1/models` (or LM Studio `/api/v0/models`) body. */
function modelRows(body: unknown): ModelRow[] {
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as ModelRow[]) : [];
}

/** The one loaded chat model on LM Studio's native list. Two or more leave `default` unattributable. */
function lmStudioServed(rows: ModelRow[]): string | null {
  const loaded = rows.filter((m) => m.state === 'loaded' && m.type !== 'embeddings' && typeof m.id === 'string');
  return loaded.length === 1 ? (loaded[0].id as string) : null;
}

/** The model a single-model llama.cpp server loaded. Router mode lists `status` and never serves `default`. */
function llamaCppServed(body: unknown): string | null {
  const rows = modelRows(body) as { id?: unknown; owned_by?: unknown; status?: unknown }[];
  if (rows.length !== 1) return null;
  const [row] = rows;
  return row.owned_by === 'llamacpp' && row.status === undefined && typeof row.id === 'string' ? row.id : null;
}

/**
 * Ask an OpenAI-compatible endpoint whether it can serve a turn, by listing its models. Cheap (no
 * generation, no tokens) and works for both LM Studio and hosted endpoints. Never throws.
 *
 * There is exactly one failure this can prove without generating, and it needs LM Studio's native list
 * (the only one that reports load `state`): nothing is loaded *and* the name we'd ask for isn't one it
 * could load, so the request dies on "No models loaded". That is the stock-config trap — an endpoint
 * pointed at LM Studio while the model name is still `default`.
 *
 * Everything else is deliberately allowed through, because a name being absent from the list does NOT
 * mean the request fails — LM Studio serves whatever is loaded when it doesn't recognize the name, and
 * llama.cpp behaves the same way. Guessing otherwise locks people out of a working setup, which is the
 * worse error. Proves the server is up and could route the request; not that the model generates.
 *
 * The same lists name the served model on LM Studio and llama.cpp, so it is read and recorded for the
 * capability cache with no extra request.
 */
export async function probeTextEndpoint(
  endpointUrl: string,
  apiToken: string,
  modelName: string,
): Promise<TextEndpointProbe> {
  const settle = (outcome: EndpointProbe, served: string | null): TextEndpointProbe => {
    recordServedModel(endpointUrl, modelName, served);
    return { outcome, served };
  };
  const urls = deriveModelsUrls(endpointUrl);
  if (!urls) return { outcome: 'unreachable', served: null };
  const headers: Record<string, string> = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};

  // LM Studio's native list first — it carries `state`, which is what makes the one provable call provable.
  // Skipped once this session has seen it 404 (probeMemo), so a hosted endpoint isn't re-asked on every check.
  if (!probeKnownAbsent(urls.lmstudio)) {
    try {
      const res = await fetch(urls.lmstudio, { headers });
      recordProbeStatus(urls.lmstudio, res.status);
      if (res.ok) {
        const rows = modelRows(await res.json().catch(() => null));
        const loaded = rows.some((m) => m.state === 'loaded');
        const known = rows.some((m) => m.id === modelName);
        // A loaded model answers to any name; an unloaded one still loads on demand if we name it.
        return settle(loaded || known || !rows.length ? 'ok' : 'unknownModel', lmStudioServed(rows));
      }
    } catch {
      // not LM Studio — fall through to the generic list
    }
  }

  // Any other server: reaching the list is all we can honestly conclude.
  try {
    const res = await fetch(urls.openai, { headers });
    if (res.ok) return settle('ok', llamaCppServed(await res.json().catch(() => null)));
  } catch {
    // unreachable
  }
  return { outcome: 'unreachable', served: null };
}

/** `probeTextEndpoint`'s outcome alone. */
export async function probeEndpoint(
  endpointUrl: string,
  apiToken: string,
  modelName: string,
): Promise<EndpointProbe> {
  return (await probeTextEndpoint(endpointUrl, apiToken, modelName)).outcome;
}
