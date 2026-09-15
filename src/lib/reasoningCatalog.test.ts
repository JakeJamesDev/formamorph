import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseReasoningCatalog, catalogSaysReasons, loadReasoningCatalog, resetReasoningCatalog,
  REASONING_CATALOG_URL, REASONING_CATALOG_STORAGE_KEY, REASONING_CATALOG_LIFETIME_MS,
} from './reasoningCatalog';

/** A models.dev slice: two providers, one shared id, one prefixed id, one model that does not reason. */
const CATALOG = {
  openai: {
    id: 'openai',
    models: {
      'gpt-5-nano': { id: 'gpt-5-nano', reasoning: true },
      'chatgpt-image-latest': { id: 'chatgpt-image-latest', reasoning: false },
    },
  },
  fireworks: {
    id: 'fireworks',
    models: {
      'qwen/Qwen3-8B': { id: 'qwen/Qwen3-8B', reasoning: true },
      'llama-v3-8b': { id: 'llama-v3-8b' },
    },
  },
};

const response = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

let urlsFetched: string[];

/** The injected fetch the resolver hands the loader: it answers the catalog URL and records every ask. */
const serving = (body: unknown, status = 200) => async (url: string) => {
  urlsFetched.push(url);
  return response(status, body);
};

let doFetch: (url: string, init?: RequestInit) => Promise<Response>;

beforeEach(() => {
  resetReasoningCatalog();
  localStorage.clear();
  urlsFetched = [];
  doFetch = serving(CATALOG);
});

describe('parseReasoningCatalog', () => {
  it('keeps only the ids the catalog marks as reasoning', () => {
    const catalog = parseReasoningCatalog(CATALOG);
    expect(catalog).not.toBeNull();
    expect(catalogSaysReasons(catalog, 'gpt-5-nano')).toBe(true);
    expect(catalogSaysReasons(catalog, 'chatgpt-image-latest')).toBe(false);
    expect(catalogSaysReasons(catalog, 'llama-v3-8b')).toBe(false);
  });

  it('rejects anything that is not the catalog shape', () => {
    expect(parseReasoningCatalog(null)).toBeNull();
    expect(parseReasoningCatalog([1, 2])).toBeNull();
    expect(parseReasoningCatalog('models')).toBeNull();
  });

  it('reads an empty object as an empty catalog, not a failure', () => {
    expect(parseReasoningCatalog({})?.size).toBe(0);
  });
});

describe('catalogSaysReasons accepts the id forms an endpoint reports', () => {
  const catalog = parseReasoningCatalog(CATALOG);

  it.each([
    ['the plain catalog id', 'gpt-5-nano'],
    ['a different case', 'GPT-5-Nano'],
    ['a provider prefix the catalog does not carry', 'openai/gpt-5-nano'],
    ['the prefixed id the catalog carries', 'qwen/Qwen3-8B'],
    ['that prefixed id in another case', 'QWEN/qwen3-8b'],
    ['that id with its prefix dropped', 'Qwen3-8B'],
    ['a repacker prefix over the catalog id', 'lmstudio-community/Qwen3-8B'],
  ])('matches %s', (_form, model) => {
    expect(catalogSaysReasons(catalog, model)).toBe(true);
  });

  it('misses an id the catalog does not list', () => {
    expect(catalogSaysReasons(catalog, 'some-local-merge-v2')).toBe(false);
  });

  it('misses on an empty model name and on a missing catalog', () => {
    expect(catalogSaysReasons(catalog, '')).toBe(false);
    expect(catalogSaysReasons(null, 'gpt-5-nano')).toBe(false);
  });
});

describe('loadReasoningCatalog', () => {
  it('fetches the public catalog once per session', async () => {
    const first = await loadReasoningCatalog(doFetch);
    const second = await loadReasoningCatalog(doFetch);
    expect(catalogSaysReasons(first, 'gpt-5-nano')).toBe(true);
    expect(second).toBe(first);
    expect(urlsFetched).toEqual([REASONING_CATALOG_URL]);
  });

  it('shares one request between callers that ask at the same time', async () => {
    const [a, b] = await Promise.all([loadReasoningCatalog(doFetch), loadReasoningCatalog(doFetch)]);
    expect(a).toBe(b);
    expect(urlsFetched).toHaveLength(1);
  });

  it('serves a stored catalog without fetching', async () => {
    localStorage.setItem(REASONING_CATALOG_STORAGE_KEY, JSON.stringify({
      at: Date.now(), ids: ['stored-thinker'],
    }));
    const catalog = await loadReasoningCatalog(doFetch);
    expect(catalogSaysReasons(catalog, 'stored-thinker')).toBe(true);
    expect(urlsFetched).toEqual([]);
  });

  it('refetches once the stored catalog is older than its lifetime', async () => {
    localStorage.setItem(REASONING_CATALOG_STORAGE_KEY, JSON.stringify({
      at: Date.now() - REASONING_CATALOG_LIFETIME_MS - 1, ids: ['stored-thinker'],
    }));
    const catalog = await loadReasoningCatalog(doFetch);
    expect(catalogSaysReasons(catalog, 'stored-thinker')).toBe(false);
    expect(catalogSaysReasons(catalog, 'gpt-5-nano')).toBe(true);
    expect(urlsFetched).toEqual([REASONING_CATALOG_URL]);
  });

  it('stores what it fetched, so the next session skips the network', async () => {
    await loadReasoningCatalog(doFetch);
    const stored = JSON.parse(localStorage.getItem(REASONING_CATALOG_STORAGE_KEY) ?? 'null') as
      { at: number; ids: string[] } | null;
    expect(stored?.ids).toContain('gpt-5-nano');
    expect(stored?.ids).not.toContain('llama-v3-8b');
    expect(stored?.at).toBeGreaterThan(0);
  });

  it('answers null when the fetch fails, and retries on the next session', async () => {
    const offline = async () => { throw new Error('offline'); };
    await expect(loadReasoningCatalog(offline)).resolves.toBeNull();
    resetReasoningCatalog();
    expect(catalogSaysReasons(await loadReasoningCatalog(doFetch), 'gpt-5-nano')).toBe(true);
  });

  it('answers null on an error status and on a body that is not the catalog', async () => {
    await expect(loadReasoningCatalog(serving({}, 503))).resolves.toBeNull();
    resetReasoningCatalog();
    await expect(loadReasoningCatalog(serving('not a catalog'))).resolves.toBeNull();
  });

  it('ignores a corrupt stored entry and fetches instead', async () => {
    localStorage.setItem(REASONING_CATALOG_STORAGE_KEY, '{ not json');
    expect(catalogSaysReasons(await loadReasoningCatalog(doFetch), 'gpt-5-nano')).toBe(true);
    expect(urlsFetched).toEqual([REASONING_CATALOG_URL]);
  });
});
