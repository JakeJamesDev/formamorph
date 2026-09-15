import { readStorageJson, writeStorageJson } from '@/lib/keyedStorage';

/** The public models.dev catalog: every provider's model list with a per-model reasoning flag. */
export const REASONING_CATALOG_URL = 'https://models.dev/api.json';

/** Where the reduced catalog is kept between sessions. */
export const REASONING_CATALOG_STORAGE_KEY = 'FORMAMORPH_reasoningCatalog';

/** How long a stored catalog stays good. Model ids and their reasoning flags change on the scale of weeks. */
export const REASONING_CATALOG_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The catalog reduced to the one question it answers: the ids whose model reasons, lowercased. A model the
 * catalog marks as non-reasoning is dropped rather than stored as `false`, so a miss and a listed "no" are
 * the same answer. That is the point — the catalog is a hint for yes, and its no is never believed.
 */
export type ReasoningCatalog = ReadonlySet<string>;

/** The fetch a load uses. Matches the resolver's, so the catalog rides the same injected fetch. */
type CatalogFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Loads the catalog. The resolver takes this, so a test never reaches the network. */
export type ReasoningCatalogLoader = (
  doFetch: CatalogFetch,
  signal?: AbortSignal,
) => Promise<ReasoningCatalog | null>;

/** One stored catalog with the time it was fetched. */
interface StoredCatalog {
  at: number;
  ids: string[];
}

/** Strips one leading `vendor/` segment, so a repacker's prefix does not hide the model underneath. */
const withoutPrefix = (id: string): string | null => {
  const cut = id.indexOf('/');
  return cut === -1 ? null : id.slice(cut + 1);
};

/**
 * Reads a models.dev response into the reasoning-id set. Each id is stored lowercased and, where the catalog
 * itself carries a `vendor/` prefix, under its bare form too, so both spellings match. Returns `null` when the
 * body is not the catalog shape.
 */
export function parseReasoningCatalog(raw: unknown): ReasoningCatalog | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const ids = new Set<string>();
  for (const provider of Object.values(raw as Record<string, unknown>)) {
    const models = (provider as { models?: unknown } | null)?.models;
    if (!models || typeof models !== 'object') continue;
    for (const [id, model] of Object.entries(models as Record<string, unknown>)) {
      if ((model as { reasoning?: unknown } | null)?.reasoning !== true) continue;
      ids.add(id.toLowerCase());
      const bare = withoutPrefix(id.toLowerCase());
      if (bare) ids.add(bare);
    }
  }
  return ids;
}

/**
 * Whether the catalog lists `model` as a reasoning model. Matching ignores case and tolerates a provider
 * prefix on either side. A `false` means the catalog has nothing to say, never that the model does not reason.
 */
export function catalogSaysReasons(catalog: ReasoningCatalog | null | undefined, model: string): boolean {
  if (!catalog || !model) return false;
  const id = model.toLowerCase();
  if (catalog.has(id)) return true;
  const bare = withoutPrefix(id);
  return bare !== null && catalog.has(bare);
}

/** This session's load, shared by every caller so the catalog is fetched at most once. */
let pending: Promise<ReasoningCatalog | null> | null = null;

/** Reads the stored catalog, or `null` when it is absent, corrupt, or past its lifetime. */
function readStoredCatalog(): ReasoningCatalog | null {
  const raw = readStorageJson('local', REASONING_CATALOG_STORAGE_KEY);
  if (!raw || typeof raw !== 'object') return null;
  const { at, ids } = raw as Partial<StoredCatalog>;
  if (typeof at !== 'number' || !Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) return null;
  if (Date.now() - at > REASONING_CATALOG_LIFETIME_MS) return null;
  return new Set(ids);
}

async function fetchCatalog(doFetch: CatalogFetch, signal?: AbortSignal): Promise<ReasoningCatalog | null> {
  try {
    const res = await doFetch(REASONING_CATALOG_URL, { signal });
    if (!res.ok) return null;
    const catalog = parseReasoningCatalog(await res.json());
    if (catalog) writeStorageJson('local', REASONING_CATALOG_STORAGE_KEY, { at: Date.now(), ids: [...catalog] });
    return catalog;
  } catch {
    return null;
  }
}

/**
 * The real loader: a stored catalog while it is fresh, otherwise one fetch whose result every caller in this
 * session shares. A failed load answers `null` and is not stored, so the next session asks again. The first
 * caller's fetch serves every later one, since the catalog is the same public file whoever asks for it.
 */
export const loadReasoningCatalog: ReasoningCatalogLoader = (doFetch, signal) => {
  pending ??= (async () => readStoredCatalog() ?? await fetchCatalog(doFetch, signal))();
  return pending;
};

/** Test-only: forget this session's load. */
export function resetReasoningCatalog(): void {
  pending = null;
}
