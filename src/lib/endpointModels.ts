/**
 * Model names an endpoint reports, cleaned for display as Overview suggestions. The parse is pure; the loader
 * asks each endpoint once per session and never throws.
 */

import { deriveModelsUrls } from '@/lib/contextLength';
import { probeKnownAbsent, recordProbeStatus } from '@/lib/probeMemo';
import { isDesktop, listLocalModels } from '@/lib/imageGen/desktop';

/** One endpoint to ask. `localEngine` reads the desktop engine's installed list instead of the network. */
export interface ModelListTarget {
  url: string;
  token: string;
  localEngine?: boolean;
}

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

/** Seams for tests; production uses the network and the desktop engine bridge. */
export interface ModelListSources {
  doFetch?: FetchLike;
  listEngine?: () => Promise<string[]>;
}

const defaultFetch: FetchLike = (url, init) => fetch(url, init);
const defaultListEngine = (): Promise<string[]> =>
  isDesktop() ? listLocalModels() : Promise.reject(new Error('no desktop engine'));

/** A row the server itself types as an embedding model; these can't narrate. */
function isEmbeddingRow(row: Record<string, unknown>): boolean {
  return typeof row.type === 'string' && row.type.startsWith('embedding');
}

/**
 * The model ids in a `/models` body: the OpenAI shape (`data[].id`, also LM Studio's `/api/v0`) or LM
 * Studio's native shape (`models[].key`). Anything malformed gives an empty list.
 */
export function modelIdsFromBody(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const { data, models } = body as { data?: unknown; models?: unknown };
  const [rows, field] = Array.isArray(data) ? [data, 'id'] : Array.isArray(models) ? [models, 'key'] : [[], 'id'];
  const ids: string[] = [];
  for (const row of rows as unknown[]) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const id = record[field];
    if (typeof id === 'string' && id.trim() && !isEmbeddingRow(record)) ids.push(id.trim());
  }
  return ids;
}

// A model file extension, or a repo's trailing format tag (`-GGUF`, `_gguf`).
const FORMAT_SUFFIX = /(?:\.(?:gguf|safetensors|bin)|[-_]gguf)$/i;
// A trailing quant tag after a separator: q4_k_m, iq4_xs, q8_0, f16, bf16, fp16, f32.
const QUANT_SUFFIX = /[-_.@:](?:i?q\d(?:_[a-z0-9]+)*|b?f16|fp16|f32)$/i;

/** A model id without its file extension and trailing quant tag. */
export function cleanModelId(id: string): string {
  const cleaned = id.trim().replace(FORMAT_SUFFIX, '').replace(QUANT_SUFFIX, '');
  return cleaned || id.trim();
}

/** Clean and de-duplicate ids case-insensitively, keeping the first spelling. */
export function cleanModelNames(ids: string[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const id of ids) {
    const name = cleanModelId(id);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** The cleaned, de-duplicated names in a `/models` body. */
export function suggestedModelNames(body: unknown): string[] {
  return cleanModelNames(modelIdsFromBody(body));
}

const cache = new Map<string, Promise<string[]>>();

/** Fetch one list URL; null when it didn't answer with a list. */
async function fetchList(url: string, headers: Record<string, string>, doFetch: FetchLike): Promise<string[] | null> {
  if (probeKnownAbsent(url)) return null;
  try {
    const res = await doFetch(url, { headers });
    const body: unknown = res.ok ? await res.json().catch(() => null) : null;
    recordProbeStatus(url, res.status, body);
    return res.ok ? suggestedModelNames(body) : null;
  } catch {
    return null;
  }
}

/** The endpoint's list, or null when neither list URL answered. */
async function fetchEndpointNames(target: ModelListTarget, doFetch: FetchLike): Promise<string[] | null> {
  const urls = deriveModelsUrls(target.url);
  if (!urls) return [];
  const headers: Record<string, string> = target.token ? { Authorization: `Bearer ${target.token}` } : {};
  // LM Studio's list first: it types embedding models, which the OpenAI list doesn't.
  const native = await fetchList(urls.lmstudio, headers, doFetch);
  if (native?.length) return native;
  return (await fetchList(urls.openai, headers, doFetch)) ?? native;
}

async function readEngineNames(listEngine: () => Promise<string[]>): Promise<string[] | null> {
  try {
    return cleanModelNames(await listEngine());
  } catch {
    return null;
  }
}

/**
 * The cleaned model names one endpoint reports. Each endpoint is asked once per session; concurrent callers
 * share the request. A failure gives an empty list and is not cached, so a server started later is found.
 */
export function loadEndpointModels(
  target: ModelListTarget,
  { doFetch = defaultFetch, listEngine = defaultListEngine }: ModelListSources = {},
): Promise<string[]> {
  const key = target.localEngine ? 'engine' : `${target.url}\n${target.token}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = (target.localEngine ? readEngineNames(listEngine) : fetchEndpointNames(target, doFetch))
    .then((names) => {
      if (names === null) cache.delete(key);
      return names ?? [];
    });
  cache.set(key, pending);
  return pending;
}

/** Test-only: forget every cached list. */
export function resetEndpointModelCache(): void {
  cache.clear();
}
