// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService, { type StoredWorldRecord } from './WorldStorageService';
import AuthService from './AuthService';
import { INSTALL_HEADER_NAME, installId } from '@/lib/anonymousLikes';

/**
 * The two reads behind the in-game like prompt.
 *
 * The listing read exists apart from `fetchListingDetails` for one reason, and it is the reason these
 * guard: the prompt has to tell a listing that has gone quiet from a network that did not answer. One
 * stops this device asking forever; the other must leave the question open.
 */

const res = (body: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  headers: { get: () => null },
} as unknown as Response);

/** The headers the last request went out with. */
const sentHeaders = () => (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>;

/** Sign in as `user`, as far as the service can tell. */
const signIn = (user: { id: string; username: string }) => {
  vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
  vi.spyOn(AuthService, 'token', 'get').mockReturnValue('a-token');
  vi.spyOn(AuthService, 'getCurrentUser').mockReturnValue(user as ReturnType<typeof AuthService.getCurrentUser>);
};

/** The smallest record `storeWorld` accepts, plus whatever provenance the case needs. */
const world = (over: Partial<StoredWorldRecord>): StoredWorldRecord => ({
  id: 'world-1',
  name: 'Sedge Landing',
  data: { worldOverview: {}, stats: [], locations: [], entities: [], traits: [], statUpdates: [] },
  ...over,
});

beforeEach(() => {
  AuthService.logout();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reading a listing for the like prompt', () => {
  it('answers with the reader’s state', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: true }, anonymousLikes: true }));

    expect(await WorldStorageService.fetchListingLikeState('listing-1')).toEqual({
      status: 'ok', liked: true, ownListing: false, anonymousLikes: true,
    });
  });

  it('reads a missing anonymous-likes flag as a server that takes none', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: false } }));

    const state = await WorldStorageService.fetchListingLikeState('listing-1');
    expect(state).toMatchObject({ status: 'ok', anonymousLikes: false });
  });

  it('names a signed-in reader’s own listing', async () => {
    signIn({ id: 'u1', username: 'author' });
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: false, author: { id: 'u1', username: 'author' } } }));

    const state = await WorldStorageService.fetchListingLikeState('listing-1');
    expect(state).toMatchObject({ status: 'ok', ownListing: true });
  });

  it('does not call somebody else’s listing the reader’s own', async () => {
    signIn({ id: 'u1', username: 'reader' });
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: false, author: { id: 'u2', username: 'author' } } }));

    const state = await WorldStorageService.fetchListingLikeState('listing-1');
    expect(state).toMatchObject({ status: 'ok', ownListing: false });
  });

  it.each([403, 404])('calls a listing refused with %i gone, which is an answer', async (status) => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Not found' }, status));

    expect(await WorldStorageService.fetchListingLikeState('listing-1')).toEqual({ status: 'gone' });
  });

  it.each([429, 500, 502, 503])('calls a %i unreachable, so a bad day never spends the one ask', async (status) => {
    vi.mocked(fetch).mockResolvedValue(res({ error: 'Try later' }, status));

    expect(await WorldStorageService.fetchListingLikeState('listing-1')).toEqual({ status: 'unreachable' });
  });

  it('calls a dead network unreachable, which is not an answer', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await WorldStorageService.fetchListingLikeState('listing-1')).toEqual({ status: 'unreachable' });
  });

  it('asks as this Install when there is no session, so a guest’s own like comes back filled', async () => {
    vi.mocked(fetch).mockResolvedValue(res({ data: { liked: true }, anonymousLikes: true }));

    await WorldStorageService.fetchListingLikeState('listing-1');

    expect(sentHeaders()[INSTALL_HEADER_NAME]).toBe(installId());
    expect(sentHeaders()['Authorization']).toBeUndefined();
  });
});

describe('reading where a stored world came from', () => {
  it('answers with the listing and the download time', async () => {
    await WorldStorageService.storeWorld(world({
      id: 'downloaded', sourceId: 'listing-1', downloadedAt: '2026-09-19T00:00:00.000Z',
    }));

    expect(await WorldStorageService.getWorldListingLink('downloaded')).toEqual({
      sourceId: 'listing-1', downloadedAt: '2026-09-19T00:00:00.000Z',
    });
  });

  it('answers empty for a world that came from no listing', async () => {
    await WorldStorageService.storeWorld(world({ id: 'authored' }));

    expect(await WorldStorageService.getWorldListingLink('authored')).toEqual({
      sourceId: undefined, downloadedAt: undefined,
    });
  });

  it('answers empty for a world that is not stored', async () => {
    expect(await WorldStorageService.getWorldListingLink('never-stored')).toEqual({
      sourceId: undefined, downloadedAt: undefined,
    });
  });

  it('answers empty rather than reading the store with no id', async () => {
    expect(await WorldStorageService.getWorldListingLink('')).toEqual({});
  });
});
