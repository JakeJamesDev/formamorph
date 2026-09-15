import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probeKnownAbsent, recordProbeStatus, resetProbeMemo } from './probeMemo';
import { fetchContextLength } from './contextLength';
import { probeEndpoint } from './useAiReachable';
import { resolveReasoningCapability } from './reasoningEffort';

// A cloud endpoint that 404s the LM Studio native lists and serves the OpenAI list.
const ENDPOINT = 'https://cloud.example/v1/chat/completions';
const V0 = 'https://cloud.example/api/v0/models';
const OPENAI = 'https://cloud.example/v1/models';

const response = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

let urlsFetched: string[];

beforeEach(() => {
  resetProbeMemo();
  urlsFetched = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const u = String(url);
    urlsFetched.push(u);
    return u === OPENAI ? response(200, { data: [] }) : response(404);
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('probeMemo', () => {
  it('remembers a 404', () => {
    recordProbeStatus(V0, 500);
    expect(probeKnownAbsent(V0)).toBe(false); // a down/erroring server proves nothing
    recordProbeStatus(V0, 404);
    expect(probeKnownAbsent(V0)).toBe(true);
  });

  // A backend that has the path but not this API answers with a method/content refusal, never a 404.
  // Live: LM Studio answers Ollama's `POST /api/show` with 415.
  it.each([405, 415])('remembers a %i, which also means this API is not here', (status) => {
    recordProbeStatus(V0, status);
    expect(probeKnownAbsent(V0)).toBe(true);
  });

  it.each([500, 502, 401, 403, 429])('keeps asking after a %i', (status) => {
    recordProbeStatus(V0, status);
    expect(probeKnownAbsent(V0)).toBe(false);
  });

  // Live: LM Studio answers `GET /props` with HTTP 200 and `{"error":"Unexpected endpoint or method."}`.
  it('remembers a 200 whose body carries an error key', () => {
    recordProbeStatus(V0, 200, { error: 'Unexpected endpoint or method. (GET /props)' });
    expect(probeKnownAbsent(V0)).toBe(true);
  });

  it('keeps asking after a 200 that answered', () => {
    recordProbeStatus(V0, 200, { models: [] });
    expect(probeKnownAbsent(V0)).toBe(false);
  });

  it('keys per URL, so one endpoint cannot silence another', () => {
    recordProbeStatus(V0, 404);
    expect(probeKnownAbsent('https://other.example/api/v0/models')).toBe(false);
  });
});

describe('probe consumers skip a native URL the session has seen 404', () => {
  it('fetchContextLength asks the native list once across calls', async () => {
    await fetchContextLength(ENDPOINT, '', 'm');
    await fetchContextLength(ENDPOINT, '', 'm');
    expect(urlsFetched.filter((u) => u === V0)).toHaveLength(1);
    expect(urlsFetched.filter((u) => u === OPENAI)).toHaveLength(2); // the real list is still consulted
  });

  it('probeEndpoint skips the native list once known absent, and still resolves ok', async () => {
    await probeEndpoint(ENDPOINT, '', 'm'); // learns the 404
    urlsFetched = [];
    await expect(probeEndpoint(ENDPOINT, '', 'm')).resolves.toBe('ok');
    expect(urlsFetched).toEqual([OPENAI]);
  });

  it('the capability resolver stops asking the native list it already saw 404', async () => {
    const target = { url: ENDPOINT, token: '', model: 'm' };
    await resolveReasoningCapability(target); // learns the 404
    urlsFetched = [];
    await resolveReasoningCapability(target);
    expect(urlsFetched).not.toContain(V0.replace('/v0/', '/v1/'));
  });

  it('the memo is shared: one feature learning the 404 silences the others', async () => {
    await probeEndpoint(ENDPOINT, '', 'm'); // learns V0's 404
    urlsFetched = [];
    await fetchContextLength(ENDPOINT, '', 'm');
    expect(urlsFetched).toEqual([OPENAI]);
  });
});
