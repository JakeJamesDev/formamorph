import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import WorldStorageService from './WorldStorageService';

const stubFetch = (response: { ok: boolean; status?: number; body?: unknown }) => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 403),
    json: async () => response.body ?? {},
    text: async () => JSON.stringify(response.body ?? {}),
  }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => vi.unstubAllGlobals());

describe('setRemoteWorldSupporterOnly', () => {
  it('PUTs the flag to the listing and returns what the server holds', async () => {
    const fetchMock = stubFetch({ ok: true, body: { success: true, data: { id: 'w1', supporterOnly: true } } });

    const held = await WorldStorageService.setRemoteWorldSupporterOnly('w1', true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/worlds\/w1\/supporter-only$/);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ supporterOnly: true });
    expect(held).toBe(true);
  });

  it('returns the server flag, not the requested one', async () => {
    stubFetch({ ok: true, body: { data: { id: 'w1', supporterOnly: false } } });

    expect(await WorldStorageService.setRemoteWorldSupporterOnly('w1', true)).toBe(false);
  });

  it('throws when the server refuses', async () => {
    stubFetch({ ok: false, status: 403, body: { error: 'Staff only' } });

    await expect(WorldStorageService.setRemoteWorldSupporterOnly('w1', true)).rejects.toThrow();
  });

  it('throws when the answer carries no flag', async () => {
    stubFetch({ ok: true, body: { success: true } });

    await expect(WorldStorageService.setRemoteWorldSupporterOnly('w1', true)).rejects.toThrow('did not say');
  });
});
