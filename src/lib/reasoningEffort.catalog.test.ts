import { describe, it, expect, beforeEach } from 'vitest';
import { resolveReasoningCapability, SAFE_REASONING_EFFORTS } from './reasoningEffort';
import { parseReasoningCatalog, REASONING_CATALOG_URL } from './reasoningCatalog';
import { resetProbeMemo } from './probeMemo';

// The same endpoint-and-model pair the resolver tests use, so a case differs only in what answers.
const TARGET = { url: 'http://host.example/v1/chat/completions', token: 't', model: 'gpt-5-nano' };
const OLLAMA = 'http://host.example/api/show';
const COMPLETIONS = TARGET.url;

/** A catalog holding one reasoning model under a provider prefix the endpoint does not report. */
const CATALOG = parseReasoningCatalog({
  openai: { id: 'openai', models: { 'gpt-5-nano': { id: 'gpt-5-nano', reasoning: true } } },
});

type Answer = { status: number; body?: unknown };

/** A backend that answers only the URLs a case names; everything else 404s, as a real one would. */
function backend(answers: Record<string, Answer>) {
  const calls: string[] = [];
  const doFetch = async (url: string) => {
    calls.push(url);
    const answer = answers[url] ?? { status: 404, body: {} };
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.body ?? {},
      text: async () => JSON.stringify(answer.body ?? {}),
    } as Response;
  };
  return { doFetch, calls };
}

/** The injected loader. Each case names the catalog it gets, or `null` for a load that failed. */
const loader = (catalog: ReturnType<typeof parseReasoningCatalog>) => {
  let loads = 0;
  return { loadCatalog: async () => { loads += 1; return catalog; }, loads: () => loads };
};

const probeCount = (calls: string[]) => calls.filter((u) => u === COMPLETIONS).length;

beforeEach(() => resetProbeMemo());

describe('the catalog answers before the probe', () => {
  it('marks a listed model as reasoning and names the catalog as the source', async () => {
    const { doFetch } = backend({});
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(record).toMatchObject({ reasons: true, levels: null, budget: null });
    expect(record?.sources.reasons).toBe('catalog');
  });

  it('sends no completion once the catalog has answered', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(probeCount(calls)).toBe(0);
  });

  it('leaves the probe to run when the catalog does not list the model', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 200, body: {} } });
    const record = await resolveReasoningCapability(
      { ...TARGET, model: 'some-local-merge-v2' }, doFetch, { loadCatalog: loader(CATALOG).loadCatalog },
    );
    expect(probeCount(calls)).toBe(1);
    expect(record).toMatchObject({ reasons: null, levels: [...SAFE_REASONING_EFFORTS] });
    expect(record?.sources.levels).toBe('probe');
  });

  it('leaves the probe to run when the catalog fails to load', async () => {
    const { doFetch, calls } = backend({ [COMPLETIONS]: { status: 400, body: {} } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(null).loadCatalog });
    expect(probeCount(calls)).toBe(1);
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
    const { doFetch } = backend({ [OLLAMA]: { status: 200, body: { capabilities: ['completion'] } } });
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(record).toMatchObject({ reasons: false, levels: [] });
    expect(record?.sources.reasons).toBe('native');
  });

  it('is not asked at all once an advertisement settled the reasons question', async () => {
    const { doFetch } = backend({ [OLLAMA]: { status: 200, body: { capabilities: ['thinking'] } } });
    const catalog = loader(CATALOG);
    await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: catalog.loadCatalog });
    expect(catalog.loads()).toBe(0);
  });

  it('keeps the strengths a partial advertisement named and adds only the reasons answer', async () => {
    // llama.cpp reports whether its template honors the effort field, and never whether the model thinks.
    const { doFetch } = backend({
      'http://host.example/props': { status: 200, body: { chat_template_caps: { supports_reasoning_effort: true } } },
    });
    const record = await resolveReasoningCapability(TARGET, doFetch, { loadCatalog: loader(CATALOG).loadCatalog });
    expect(record).toMatchObject({ reasons: true, levels: [...SAFE_REASONING_EFFORTS] });
    expect(record?.sources).toMatchObject({ reasons: 'catalog', levels: 'native' });
  });
});

describe('the default loader', () => {
  it('asks the public catalog once, through the resolver\'s own fetch', async () => {
    const { doFetch, calls } = backend({});
    await resolveReasoningCapability(TARGET, doFetch);
    await resolveReasoningCapability({ ...TARGET, model: 'other' }, doFetch);
    expect(calls.filter((u) => u === REASONING_CATALOG_URL)).toHaveLength(1);
  });
});
