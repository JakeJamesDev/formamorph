import { describe, it, expect, vi, afterEach } from 'vitest';
import { probeEndpoint } from './useAiReachable';

const ENDPOINT = 'http://localhost:1234/v1/chat/completions';
const OPENAI_URL = 'http://localhost:1234/v1/models';
const LMS_URL = 'http://localhost:1234/api/v0/models';

/** Stand in for fetch, answering per-URL. A url absent from `routes` behaves like a dead server. */
function mockFetch(routes: Record<string, { ok?: boolean; body?: unknown }>) {
  const fetchMock = vi.fn(async (url: string) => {
    const route = routes[url];
    if (!route) throw new Error('connection refused');
    return { ok: route.ok ?? true, json: async () => route.body } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** LM Studio's native list: ids plus the load `state` no other server reports. */
const lmsList = (...models: [string, 'loaded' | 'not-loaded'][]) => ({
  data: models.map(([id, state]) => ({ id, object: 'model', state, type: 'llm' })),
});

/** The plain OpenAI list, which carries no load state. */
const openaiList = (...ids: string[]) => ({ object: 'list', data: ids.map((id) => ({ id, object: 'model' })) });

afterEach(() => vi.unstubAllGlobals());

describe('probeEndpoint', () => {
  // The one case worth blocking: LM Studio up, nothing loaded, and a name it can't load.
  it('reports unknownModel when nothing is loaded and the name is not one it could load', async () => {
    mockFetch({ [LMS_URL]: { body: lmsList(['cydonia-24b-v4.3', 'not-loaded']) } });
    expect(await probeEndpoint(ENDPOINT, '', 'default')).toBe('unknownModel');
    expect(await probeEndpoint(ENDPOINT, '', '')).toBe('unknownModel');
  });

  // Regression: LM Studio serves whatever is loaded for a name it doesn't know, so this must NOT block.
  it('is ok for an unlisted name when a model is loaded', async () => {
    mockFetch({
      [LMS_URL]: { body: lmsList(['silver-siren-st-12b-i1', 'loaded'], ['cydonia-24b-v4.3', 'not-loaded']) },
    });
    expect(await probeEndpoint(ENDPOINT, '', 'default')).toBe('ok');
  });

  // Nothing loaded is fine so long as we name something it can load — it loads on demand.
  it('is ok for a listed name even when nothing is loaded', async () => {
    mockFetch({ [LMS_URL]: { body: lmsList(['cydonia-24b-v4.3', 'not-loaded']) } });
    expect(await probeEndpoint(ENDPOINT, '', 'cydonia-24b-v4.3')).toBe('ok');
  });

  it('is ok when LM Studio answers with an empty or unreadable list', async () => {
    mockFetch({ [LMS_URL]: { body: { data: [] } } });
    expect(await probeEndpoint(ENDPOINT, '', 'default')).toBe('ok');

    mockFetch({ [LMS_URL]: { body: 'not json at all' } });
    expect(await probeEndpoint(ENDPOINT, '', 'default')).toBe('ok');
  });

  // Non-LM-Studio servers report no load state, so reaching the list is all we can conclude.
  it('is ok for a non-LM-Studio server that answers the generic list', async () => {
    mockFetch({ [OPENAI_URL]: { body: openaiList('cydonia-24b-v4.3') } });
    expect(await probeEndpoint(ENDPOINT, '', 'anything-at-all')).toBe('ok');
  });

  it('is ok for the hosted default endpoint', async () => {
    mockFetch({ 'https://api.lyonade.net/v1/models': { body: openaiList('default') } });
    expect(await probeEndpoint('https://api.lyonade.net/v1/chat/completions', '', 'default')).toBe('ok');
  });

  it('falls through to the generic list when the LM Studio path 404s', async () => {
    mockFetch({ [LMS_URL]: { ok: false }, [OPENAI_URL]: { body: openaiList('m') } });
    expect(await probeEndpoint(ENDPOINT, '', 'default')).toBe('ok');
  });

  it('is unreachable when nothing answers', async () => {
    mockFetch({});
    expect(await probeEndpoint(ENDPOINT, '', 'anything')).toBe('unreachable');
  });

  it('is unreachable for an unparseable endpoint url', async () => {
    mockFetch({});
    expect(await probeEndpoint('not a url', '', 'anything')).toBe('unreachable');
  });

  it('sends the api token as a bearer header when one is set', async () => {
    const fetchMock = mockFetch({ [LMS_URL]: { body: lmsList(['m', 'loaded']) } });
    await probeEndpoint(ENDPOINT, 'secret-token', 'm');
    expect(fetchMock).toHaveBeenCalledWith(LMS_URL, { headers: { Authorization: 'Bearer secret-token' } });
  });
});
