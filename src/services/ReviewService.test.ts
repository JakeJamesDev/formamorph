import { describe, it, expect, afterEach, vi } from 'vitest';
import ReviewService from './ReviewService';

const answer = (status: number, body: unknown = {}) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe('reading the review meta', () => {
  it('asks the meta route', async () => {
    const fetchSpy = answer(200, { success: true, data: { enabled: false } });

    await ReviewService.fetchMeta();

    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/reviews\/meta$/);
  });

  it('returns the setting when the server has review', async () => {
    answer(200, { success: true, data: { enabled: true } });

    expect(await ReviewService.fetchMeta()).toEqual({ enabled: true });
  });

  it('returns null on a 404, the feature being absent', async () => {
    answer(404);

    expect(await ReviewService.fetchMeta()).toBeNull();
  });

  it('returns undefined on a 401 or a 5xx', async () => {
    answer(401);
    expect(await ReviewService.fetchMeta()).toBeUndefined();

    answer(503);
    expect(await ReviewService.fetchMeta()).toBeUndefined();
  });

  it('returns undefined when the connection drops', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await ReviewService.fetchMeta()).toBeUndefined();
  });

  it('returns undefined for a body without the setting', async () => {
    answer(200, { success: true, data: {} });

    expect(await ReviewService.fetchMeta()).toBeUndefined();
  });
});
