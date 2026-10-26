import { describe, it, expect, afterEach, vi } from 'vitest';
import ReviewService, { ReviewConflictError } from './ReviewService';

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

describe('working the queue', () => {
  it('reads the count, and 0 when the route refuses or the connection drops', async () => {
    answer(200, { success: true, data: { count: 4 } });
    expect(await ReviewService.fetchCount()).toBe(4);

    answer(404);
    expect(await ReviewService.fetchCount()).toBe(0);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await ReviewService.fetchCount()).toBe(0);
  });

  it('sends a new listing’s length with the rejection, and none for a resubmission', async () => {
    const fetchSpy = answer(200, { success: true, data: { id: 'w1', author: null } });

    await ReviewService.reject('w1', 14);
    await ReviewService.reject('w1');

    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/reviews\/w1\/reject$/);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({ days: 14 });
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({});
  });

  it('downloads the content file, not the listing row around it', async () => {
    answer(200, { success: true, data: { id: 'w1', name: 'Sedge Landing', thumbnail: 'data:…', contentData: { worldOverview: { name: 'Sedge Landing' } } } });

    expect(await ReviewService.fetchContent('w1')).toEqual({ worldOverview: { name: 'Sedge Landing' } });
  });

  it('throws a conflict on a 409, with the server’s words', async () => {
    answer(409, { success: false, error: 'This is no longer waiting for review' });

    const failure = await ReviewService.approve('w1').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ReviewConflictError);
    expect((failure as Error).message).toBe('This is no longer waiting for review');
  });

  it('throws an ordinary error on any other refusal', async () => {
    answer(403, { success: false, error: 'Staff cannot moderate this account' });

    const failure = await ReviewService.approve('w1').catch((error: unknown) => error);

    expect(failure).not.toBeInstanceOf(ReviewConflictError);
    expect((failure as Error).message).toBe('Staff cannot moderate this account');
  });
});
