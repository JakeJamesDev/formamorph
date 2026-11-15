/**
 * Coref Model Store: downloads one manifest entry's files into the browser cache, checks each file's size and
 * SHA-256, and reads them back for the Coref Host.
 */
import type { TokenizerJson } from './bpe';
import type { CorefModelFiles } from './corefClient';
import { COREF_FILE_KEYS, entrySize, parseHostConfig, type CorefManifestEntry } from './corefManifest';

export const COREF_CACHE_NAME = 'formamorph-coref';

export interface CorefDownloadProgress {
  loaded: number;
  total: number;
}

/** The browser APIs the store uses; tests pass fakes. */
export interface CorefStoreDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  caches: Pick<CacheStorage, 'open' | 'delete'>;
  sha256: (bytes: Uint8Array<ArrayBuffer>) => Promise<string>;
  /** Bytes per cache part; tests shrink it. */
  partBytes?: number;
}

/** Hex SHA-256 of `bytes`. */
export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const browserStoreDeps = (): CorefStoreDeps => ({
  fetch: (url, init) => fetch(url, init),
  // Read at each call: a page outside a secure context has no `caches`, and the download then fails with an error row.
  caches: {
    open: (name) => caches.open(name),
    delete: (name) => caches.delete(name),
  },
  sha256: sha256Hex,
});

/** Raised when a downloaded file is not the file the manifest lists. */
export class CorefFileMismatchError extends Error {
  constructor() {
    super('A downloaded file did not match its checksum');
    this.name = 'CorefFileMismatchError';
  }
}

async function readBody(response: Response, size: number, onBytes: (n: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new Uint8Array(new ArrayBuffer(size));
  if (!response.body) {
    const whole = new Uint8Array(await response.arrayBuffer());
    if (whole.length !== size) throw new CorefFileMismatchError();
    bytes.set(whole);
    onBytes(size);
    return bytes;
  }
  const reader = response.body.getReader();
  let offset = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.length > size) {
      await reader.cancel();
      throw new CorefFileMismatchError();
    }
    bytes.set(value, offset);
    offset += value.length;
    onBytes(offset);
  }
  if (offset !== size) throw new CorefFileMismatchError();
  return bytes;
}

// Chromium refuses one cache entry near 370 MB, so each file is stored as parts of at most this size.
export const CACHE_PART_BYTES = 64 * 1048576;

const partSize = (deps: CorefStoreDeps) => deps.partBytes ?? CACHE_PART_BYTES;

const partCount = (size: number, partBytes: number) => Math.max(1, Math.ceil(size / partBytes));

/** The cache key of one part of a file. */
function partUrl(url: string, part: number): string {
  const key = new URL(url, 'https://coref.invalid/');
  key.searchParams.set('fm-part', String(part));
  return key.href;
}

/** Whether every part of a file is cached with the sizes the manifest implies. */
async function isFileCached(cache: Cache, url: string, size: number, partBytes: number): Promise<boolean> {
  for (let part = 0; part < partCount(size, partBytes); part++) {
    const hit = await cache.match(partUrl(url, part));
    const expected = Math.min(partBytes, size - part * partBytes);
    if (!hit || Number(hit.headers.get('content-length')) !== expected) return false;
  }
  return true;
}

async function putFile(cache: Cache, url: string, bytes: Uint8Array<ArrayBuffer>, partBytes: number): Promise<void> {
  for (let part = 0; part < partCount(bytes.length, partBytes); part++) {
    const slice = bytes.slice(part * partBytes, (part + 1) * partBytes);
    await cache.put(partUrl(url, part), new Response(slice, { headers: { 'content-length': String(slice.length) } }));
  }
}

async function readFile(cache: Cache, url: string, size: number, partBytes: number): Promise<ArrayBuffer> {
  const whole = new Uint8Array(new ArrayBuffer(size));
  for (let part = 0; part < partCount(size, partBytes); part++) {
    const hit = await cache.match(partUrl(url, part));
    if (!hit) throw new Error('A model file is missing from the cache');
    const bytes = new Uint8Array(await hit.arrayBuffer());
    if (part * partBytes + bytes.length > size) throw new CorefFileMismatchError();
    whole.set(bytes, part * partBytes);
  }
  return whole.buffer;
}

/** Download every file of `entry` that the cache lacks. A file is cached only after its size and hash check. */
export async function downloadEntry(
  entry: CorefManifestEntry,
  deps: CorefStoreDeps,
  onProgress: (progress: CorefDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const cache = await deps.caches.open(COREF_CACHE_NAME);
  const total = entrySize(entry);
  let done = 0;
  onProgress({ loaded: 0, total });
  for (const key of COREF_FILE_KEYS) {
    const file = entry.files[key];
    if (await isFileCached(cache, file.url, file.size, partSize(deps))) {
      done += file.size;
      onProgress({ loaded: done, total });
      continue;
    }
    const response = await deps.fetch(file.url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not download a model file (error ${response.status})`);
    const bytes = await readBody(response, file.size, (n) => onProgress({ loaded: done + n, total }));
    if ((await deps.sha256(bytes)) !== file.sha256) throw new CorefFileMismatchError();
    signal?.throwIfAborted();
    await putFile(cache, file.url, bytes, partSize(deps));
    done += file.size;
  }
}

/** The cached files of `entry`, ready for the host. Throws when one is missing. */
export async function readEntryFiles(entry: CorefManifestEntry, deps: CorefStoreDeps): Promise<CorefModelFiles> {
  const cache = await deps.caches.open(COREF_CACHE_NAME);
  const read = (key: (typeof COREF_FILE_KEYS)[number]) => readFile(cache, entry.files[key].url, entry.files[key].size, partSize(deps));
  const text = async (key: (typeof COREF_FILE_KEYS)[number]): Promise<unknown> => JSON.parse(new TextDecoder().decode(await read(key)));
  return {
    graphA: await read('graph_a'),
    graphB: await read('graph_b'),
    tokenizer: (await text('tokenizer')) as TokenizerJson,
    config: parseHostConfig(await text('hostConfig')),
  };
}

/** Whether every file of `entry` is cached. */
export async function isEntryCached(entry: CorefManifestEntry, deps: CorefStoreDeps): Promise<boolean> {
  const cache = await deps.caches.open(COREF_CACHE_NAME);
  for (const key of COREF_FILE_KEYS) {
    if (!(await isFileCached(cache, entry.files[key].url, entry.files[key].size, partSize(deps)))) return false;
  }
  return true;
}

/** Delete every cached file except those of `keep`. */
export async function pruneCache(keep: CorefManifestEntry | null, deps: CorefStoreDeps): Promise<void> {
  if (!keep) {
    await deps.caches.delete(COREF_CACHE_NAME);
    return;
  }
  const cache = await deps.caches.open(COREF_CACHE_NAME);
  const kept = new Set(COREF_FILE_KEYS.flatMap((key) => {
    const { url, size } = keep.files[key];
    return Array.from({ length: partCount(size, partSize(deps)) }, (_, part) => partUrl(url, part));
  }));
  for (const request of await cache.keys()) {
    if (!kept.has(request.url)) await cache.delete(request);
  }
}
