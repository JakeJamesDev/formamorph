import { describe, it, expect, afterEach, onTestFinished, vi } from 'vitest';
import ReviewService, { ReviewConflictError } from './ReviewService';
import AuthService from './AuthService';

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

  it('carries the server’s code on a 409, so a judging hold reads apart from a settled item', async () => {
    answer(409, { success: false, code: 'CONTEST_LOCKED', error: 'Spooky Season is being judged' });

    const failure = await ReviewService.approve('w1').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ReviewConflictError);
    expect((failure as ReviewConflictError).code).toBe('CONTEST_LOCKED');
  });

  it('throws an ordinary error on any other refusal', async () => {
    answer(403, { success: false, error: 'Staff cannot moderate this account' });

    const failure = await ReviewService.approve('w1').catch((error: unknown) => error);

    expect(failure).not.toBeInstanceOf(ReviewConflictError);
    expect((failure as Error).message).toBe('Staff cannot moderate this account');
  });
});

describe('reading the auto-approvals', () => {
  it('asks the auto route with the page and limit, and returns the server’s entries and total', async () => {
    const entry = {
      id: 7, targetId: 'w1', targetKind: 'world', targetName: 'Sedge Landing',
      actor: { id: 'u1', username: 'wren_hallow', role: null }, createdAt: '2026-10-25T12:00:00.000Z',
    };
    const fetchSpy = answer(200, { success: true, total: 41, entries: [entry] });

    const page = await ReviewService.fetchAutoApproved({ page: 2, limit: 20 });

    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/reviews\/auto\?page=2&limit=20$/);
    expect(page).toEqual({ entries: [entry], total: 41 });
  });

  it('throws the server’s words on a refusal', async () => {
    answer(403, { success: false, error: 'Staff only' });

    await expect(ReviewService.fetchAutoApproved()).rejects.toThrow('Staff only');
  });
});

describe('changing trust', () => {
  it('grants with a PUT on the account’s trust route and returns what the server stored', async () => {
    const fetchSpy = answer(200, { success: true, user: { id: 'u1', username: 'wren_hallow', trustedAt: '2026-10-25T12:00:00.000Z' } });

    const stored = await ReviewService.setTrusted('u1', true);

    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/users\/u1\/trust$/);
    expect(fetchSpy.mock.calls[0][1]?.method).toBe('PUT');
    expect(stored.trustedAt).toBe('2026-10-25T12:00:00.000Z');
  });

  it('revokes with a DELETE', async () => {
    const fetchSpy = answer(200, { success: true, user: { id: 'u1', username: 'wren_hallow', trustedAt: null } });

    const stored = await ReviewService.setTrusted('u1', false);

    expect(fetchSpy.mock.calls[0][1]?.method).toBe('DELETE');
    expect(stored.trustedAt).toBeNull();
  });

  it('throws the server’s words when an admin-only route refuses', async () => {
    answer(403, { success: false, error: 'Admins only' });

    await expect(ReviewService.setTrusted('u1', true)).rejects.toThrow('Admins only');
  });
});

describe('the author’s pending update', () => {
  it('discards with a DELETE on the review route', async () => {
    const fetchSpy = answer(200, { success: true, data: { id: 'w1' } });

    expect(await ReviewService.discardUpdate('w1')).toBe(true);

    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/reviews\/w1$/);
    expect(fetchSpy.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('answers false when no update waits any more', async () => {
    answer(404, { success: false, error: 'Not found' });

    expect(await ReviewService.discardUpdate('w1')).toBe(false);
  });

  it('throws the server’s words on any other refusal', async () => {
    answer(500, { success: false, error: 'Server down' });

    await expect(ReviewService.discardUpdate('w1')).rejects.toThrow('Server down');
  });

  it('reads the held thumbnail from the API origin with the Bearer token', async () => {
    const before = AuthService.token;
    AuthService.token = 'tok';
    onTestFinished(() => { AuthService.token = before; });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('png', { status: 200 }));

    const blob = await ReviewService.fetchPendingThumbnail('/api/reviews/w1/thumbnail');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(new URL(String(url)).pathname).toBe('/api/reviews/w1/thumbnail');
    expect(new URL(String(url)).origin).toBe(new URL(AuthService.API_URL).origin);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(await blob.text()).toBe('png');
  });
});
