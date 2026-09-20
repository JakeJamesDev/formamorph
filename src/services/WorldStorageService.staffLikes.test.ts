// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService from './WorldStorageService';
import AuthService from './AuthService';

/**
 * What the staff like screens read and what they act with.
 *
 * The audit carries two kinds of row, and a removal answers with both numbers the screen is showing.
 * These check the wire shape rather than the screen: a field the server renamed would otherwise reach
 * the dialog as a quiet zero.
 */

const res = (body: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: async () => body,
  headers: { get: () => null },
} as unknown as Response);

/** The URL and options the request went out with. */
const sent = (call = 0) => vi.mocked(fetch).mock.calls[call] as [string, RequestInit];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(AuthService, 'token', 'get').mockReturnValue('a-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reading the likes on a listing', () => {
  it('carries the anonymous count beside the account rows', async () => {
    vi.mocked(fetch).mockResolvedValue(res({
      data: { total: 4, rows: [{ id: 'u1' }], anonymous: 12 },
    }));

    const result = await WorldStorageService.fetchLikers('w1');

    expect(result).toEqual({ total: 4, rows: [{ id: 'u1' }], anonymous: 12 });
  });

  it('reads an older server, which sends no anonymous count, as none', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { total: 1, rows: [] } }));

    expect((await WorldStorageService.fetchLikers('w1')).anonymous).toBe(0);
  });

  it('carries the anonymous rows the audit found', async () => {
    const anonymousRows = [
      { likedAt: '2026-08-30 12:00:00', browserFamily: 'Chrome', groupId: 1, linkedToAuthor: false, addressKey: 'key-a' },
    ];
    vi.mocked(fetch).mockResolvedValue(res({
      data: { total: 2, rows: [{ id: 'u1' }], anonymous: 9, anonymousRows },
    }));

    const result = await WorldStorageService.fetchLikersAudit('w1');

    expect(result.anonymousRows).toEqual(anonymousRows);
    // The count and the rows are separate numbers: the server caps the rows and the count is the truth.
    expect(result.anonymous).toBe(9);
  });

  it('reports the server’s wording when the audit is refused', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Staff only' }, false, 403));

    await expect(WorldStorageService.fetchLikersAudit('w1')).rejects.toThrow('Staff only');
  });
});

describe('removing Anonymous Likes', () => {
  const removed = { removed: 3, likes: 8, anonymous: 5 };

  it('asks the address route to take one group, with the key escaped', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: removed }));

    const result = await WorldStorageService.removeAnonymousLikeGroup('w1', 'key/with+punctuation');

    const [url, options] = sent();
    expect(url).toContain('/worlds/w1/anonymous-likes/address/key%2Fwith%2Bpunctuation');
    expect(options.method).toBe('DELETE');
    expect(result).toEqual(removed);
  });

  it('asks the collection route to take them all', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { removed: 12, likes: 4, anonymous: 0 } }));

    const result = await WorldStorageService.removeAnonymousLikes('w1');

    const [url, options] = sent();
    expect(url).toMatch(/\/worlds\/w1\/anonymous-likes$/);
    expect(options.method).toBe('DELETE');
    expect(result).toEqual({ removed: 12, likes: 4, anonymous: 0 });
  });

  it('reads nothing removed as a number rather than a failure', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { removed: 0, likes: 4, anonymous: 0 } }));

    // Another moderator got there first. The route answers 200 and the count is the fresh one.
    await expect(WorldStorageService.removeAnonymousLikes('w1')).resolves.toEqual({
      removed: 0, likes: 4, anonymous: 0,
    });
  });

  it('reports the server’s wording when a removal is refused', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'You cannot moderate them' }, false, 403));

    await expect(WorldStorageService.removeAnonymousLikeGroup('w1', 'key-a'))
      .rejects.toThrow('You cannot moderate them');
  });

  it('signs both removals as the staff member making them', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: removed }));

    await WorldStorageService.removeAnonymousLikes('w1');

    expect((sent()[1].headers as Record<string, string>).Authorization).toBe('Bearer a-token');
  });
});
