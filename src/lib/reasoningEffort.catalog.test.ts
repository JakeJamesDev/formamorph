import { describe, it, expect, beforeEach } from 'vitest';
import { resolveReasoningCapability, SAFE_REASONING_EFFORTS } from './reasoningEffort';
import { parseReasoningCatalog, resetReasoningCatalog, REASONING_CATALOG_URL, REASONING_CATALOG_STORAGE_KEY } from './reasoningCatalog';
import { resetProbeMemo } from './probeMemo';
import {
  reasoningBackend as backend, probeCount, probeKinds, REASONING_TARGET,
  OLLAMA_URL, PROPS_URL, COMPLETIONS_URL,
} from '@/test/reasoningBackend';

// The catalog answers on the model id, so this suite names a model the catalog knows.
const TARGET = { ...REASONING_TARGET, model: 'gpt-5-nano' };

/** A catalog holding one reasoning model, and the raw body a served catalog URL returns. */
const CATALOG_BODY = { openai: { id: 'openai', models: { 'gpt-5-nano': { id: 'gpt-5-nano', reasoning: true } } } };
const CATALOG = parseReasoningCatalog(CATALOG_BODY);

/** The injected loader. Each case names the catalog it gets, or `null` for a load that failed. */
const loader = (catalog: ReturnType<typeof parseReasoningCatalog>) => {
  let loads = 0;
  return { loadCatalog: async () => { loads += 1; return catalog; }, loads: () => loads };
};

beforeEach(() => {
  resetProbeMemo();
  resetReasoningCatalog();
  localStorage.clear();
});

describe('the catalog answers before the probe', () => {
  it('marks a listed model as reasoning and names the catalog as the source', async () => {
    const { doFetch } = backend({});
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(record).toMatchObject({ reasons: true, levels: null, budget: null });
    expect(record?.sources.reasons).toBe('catalog');
  });

  it('sends no reasoning probe once the catalog has answered', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS_URL]: { status: 200, body: {} } });
    await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(probeKinds(calls)).toEqual(['tools']);
  });

  it('leaves the probe to run when the catalog does not list the model', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS_URL]: { status: 200, body: {} } });
    const record = await resolveReasoningCapability(
      { ...TARGET, model: 'some-local-merge-v2' }, doFetch, { loadCatalog: loader(CATALOG).loadCatalog },
    );
    expect(probeCount(calls)).toBe(1);
    expect(record).toMatchObject({ reasons: null, levels: [...SAFE_REASONING_EFFORTS] });
    expect(record?.sources.levels).toBe('probe');
  });

  it('leaves the probe to run when the catalog fails to load', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS_URL]: { status: 400, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(null).loadCatalog });
    expect(probeKinds(calls)).toEqual(['bundle', 'reasoning', 'tools']);
    expect(record?.sources.reasons).toBe('probe');
  });

  it.each([
    ['a provider prefix the catalog does not carry', 'openai/gpt-5-nano'],
    ['a repacker prefix over the catalog id', 'lmstudio-community/gpt-5-nano'],
    ['a different case', 'GPT-5-NANO'],
  ])('matches a model the endpoint reports with %s', async (_form, model) => {
    const { doFetch } = backend({});
    const record = await resolveReasoningCapability({ ...TARGET, model }, doFetch, {
      loadCatalog: loader(CATALOG).loadCatalog,
    });
    expect(record?.reasons).toBe(true);
  });
});

describe('the catalog never outranks an advertisement', () => {
  it('keeps a native no for a model the catalog lists as reasoning', async () => {
    const { doFetch } = backend({ [OLLAMA_URL]: { status: 200, body: { capabilities: ['completion'] } } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(record).toMatchObject({ reasons: false, levels: [] });
    expect(record?.sources.reasons).toBe('native');
  });

  it('is not asked at all once an advertisement settled the reasons question', async () => {
    const { doFetch } = backend({ [OLLAMA_URL]: { status: 200, body: { capabilities: ['thinking'] } } });
    const catalog = loader(CATALOG);
    await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: catalog.loadCatalog });
    expect(catalog.loads()).toBe(0);
  });

  it('keeps the strengths a partial advertisement named and adds only the reasons answer', async () => {
    // llama.cpp reports whether its template honors the effort field, and never whether the model thinks.
    const { doFetch } = backend({
      [PROPS_URL]: { status: 200, body: { chat_template_caps: { supports_reasoning_effort: true } } },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(record).toMatchObject({ reasons: true, levels: [...SAFE_REASONING_EFFORTS] });
    expect(record?.sources).toMatchObject({ reasons: 'catalog', levels: 'native' });
  });
});

describe('the default loader', () => {
  const catalogCalls = (calls: readonly { url: string }[]) =>
    calls.filter((c) => c.url === REASONING_CATALOG_URL);

  it('asks the public catalog once, through the resolver\'s own fetch', async () => {
    const { doFetch, calls } = backend({});
    await resolveReasoningCapability(TARGET, doFetch);
    await resolveReasoningCapability({ ...TARGET, model: 'other' }, doFetch);
    expect(catalogCalls(calls)).toHaveLength(1);
  });

  // One session shares one load. A resolve the player abandons by retyping the endpoint must not take the
  // catalog down with it, or every later endpoint in that session falls through to the probe.
  it('keeps the shared load out of one resolve\'s abort', async () => {
    const { doFetch: served } = backend({ [REASONING_CATALOG_URL]: { status: 200, body: CATALOG_BODY } });
    const doFetch = async (url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new Error('aborted');
      return served(url, init);
    };
    const record = await resolveReasoningCapability(TARGET, doFetch, { signal: AbortSignal.abort() });
    expect(record).toMatchObject({ reasons: true });
    expect(record?.sources.reasons).toBe('catalog');
  });

  it('stores what it fetched, so the next session answers without asking again', async () => {
    const { doFetch } = backend({ [REASONING_CATALOG_URL]: { status: 200, body: CATALOG_BODY } });
    await resolveReasoningCapability(TARGET, doFetch);
    expect(localStorage.getItem(REASONING_CATALOG_STORAGE_KEY)).toContain('gpt-5-nano');

    resetReasoningCatalog(); // a new session, same browser
    const { doFetch: offline, calls } = backend({});
    const record = await resolveReasoningCapability(TARGET, offline);
    expect(record?.sources.reasons).toBe('catalog');
    expect(catalogCalls(calls)).toHaveLength(0);
  });
});
