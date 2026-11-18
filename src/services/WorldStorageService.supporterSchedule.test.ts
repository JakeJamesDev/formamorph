import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import WorldStorageService from './WorldStorageService';

const stubFetch = (response: { ok: boolean; status?: number; body?: unknown }) => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: async () => response.body ?? {},
    text: async () => JSON.stringify(response.body ?? {}),
  }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => vi.unstubAllGlobals());

describe('setRemoteWorldSupporterSchedule', () => {
  const dates = { opensAt: { supporter_plus: '2026-11-23T00:00:00.000Z', supporter: null }, publicAt: '2026-12-03T00:00:00.000Z' };

  it('PUTs the dates form and returns the public date and stages the server holds', async () => {
    const held = [{ tier: 'supporter_plus', opensAt: dates.opensAt.supporter_plus }, { tier: 'supporter', opensAt: dates.publicAt }];
    const fetchMock = stubFetch({
      ok: true,
      body: { data: { id: 'w1', supporterOnly: true, supporterUntil: dates.publicAt, supporterSchedule: held } },
    });

    const saved = await WorldStorageService.setRemoteWorldSupporterSchedule('w1', dates);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/worlds\/w1\/supporter-only$/);
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ supporterOnly: true, supporterSchedule: dates });
    expect(saved).toEqual({ until: dates.publicAt, schedule: held });
  });

  it('PUTs the older supporterUntil form for a public date alone, with no schedule key', async () => {
    const fetchMock = stubFetch({ ok: true, body: { data: { id: 'w1', supporterOnly: true, supporterUntil: dates.publicAt } } });

    const saved = await WorldStorageService.setRemoteWorldSupporterSchedule('w1', { publicAt: dates.publicAt });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ supporterOnly: true, supporterUntil: dates.publicAt });
    expect(saved).toEqual({ until: dates.publicAt, schedule: [] });
  });

  it('reads an answer with no public date and no stages as none', async () => {
    stubFetch({ ok: true, body: { data: { id: 'w1', supporterOnly: true } } });

    expect(await WorldStorageService.setRemoteWorldSupporterSchedule('w1', { opensAt: {}, publicAt: null })).toEqual({ until: null, schedule: [] });
  });

  it('throws the server\'s refusal text', async () => {
    stubFetch({ ok: false, status: 400, body: { success: false, error: 'A lower tier cannot open before a higher one' } });

    await expect(WorldStorageService.setRemoteWorldSupporterSchedule('w1', dates)).rejects.toThrow('A lower tier cannot open before a higher one');
  });
});
