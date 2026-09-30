import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PREFETCH_REUSE_MS, forgetListingPrefetch, loadListingDetails, prefetchListing, takePrefetchedComments,
} from './listingDetailsLoader';
import { clearListingDetails, getCachedDetails, putCachedDetails } from './listingDetailsCache';
import WorldStorageService, { type ListingDetails, type ListingDetailsRead } from '@/services/WorldStorageService';

let reader = 'account-1';
vi.mock('@/lib/currentReader', () => ({ currentReader: () => reader }));

const details = (title: string): ListingDetails => ({
  changelog: [{
    id: title, world_id: 'w1', title, body: 'Changed.', entry_date: '2026-08-01',
    created_at: '2026-08-01T12:00:00.000Z', updated_at: '2026-08-01T12:00:00.000Z',
  }],
  anonymousLikes: true,
  compatibleWorlds: [],
});

// The server read stays open until a test answers it.
let answer: (read: ListingDetailsRead) => void;
const holdServer = () => vi.spyOn(WorldStorageService, 'readListingDetails')
  .mockReturnValue(new Promise((resolve) => { answer = resolve; }));

beforeEach(async () => {
  reader = 'account-1';
  forgetListingPrefetch();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await clearListingDetails();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('loading a listing’s details', () => {
  it('stores exactly what the server answered', async () => {
    holdServer();
    const load = loadListingDetails('w1');
    expect(await load.cached).toBeNull(); // settles once the empty disk read answers

    answer({ status: 'ok', details: details('Update 1') });

    expect(await load.fresh).toEqual({ status: 'ok', details: details('Update 1') });
    await vi.waitFor(async () => expect(await getCachedDetails('w1')).toEqual(details('Update 1')));
  });

  it('hands back the cached details before the server answers', async () => {
    await putCachedDetails('w1', details('Last visit'));
    holdServer();

    const load = loadListingDetails('w1');

    expect(await load.cached).toEqual(details('Last visit'));
  });

  it('replaces the entry with the fresh answer', async () => {
    await putCachedDetails('w1', details('Last visit'));
    holdServer();

    const load = loadListingDetails('w1');
    await load.cached;
    answer({ status: 'ok', details: details('Today') });
    await load.fresh;

    await vi.waitFor(async () => expect(await getCachedDetails('w1')).toEqual(details('Today')));
  });

  it('drops the entry when the listing is gone for this reader', async () => {
    await putCachedDetails('w1', details('Last visit'));
    holdServer();

    const load = loadListingDetails('w1');
    await load.cached;
    answer({ status: 'gone' });
    await load.fresh;

    await vi.waitFor(async () => expect(await getCachedDetails('w1')).toBeNull());
  });

  it('keeps the entry when the server does not answer', async () => {
    await putCachedDetails('w1', details('Last visit'));
    holdServer();

    const load = loadListingDetails('w1');
    await load.cached;
    answer({ status: 'unreachable' });
    await load.fresh;

    // A write, had one been queued, lands before this read: IndexedDB runs transactions in order.
    expect(await getCachedDetails('w1')).toEqual(details('Last visit'));
  });

  it('reads a request that throws as no answer, and keeps the entry', async () => {
    await putCachedDetails('w1', details('Last visit'));
    vi.spyOn(WorldStorageService, 'readListingDetails').mockRejectedValue(new Error('offline'));

    const load = loadListingDetails('w1');

    expect(await load.fresh).toEqual({ status: 'unreachable' });
    expect(await getCachedDetails('w1')).toEqual(details('Last visit'));
  });

  it('still hands back the cached details when the server fails before the disk answers', async () => {
    await putCachedDetails('w1', details('Last visit'));
    vi.spyOn(WorldStorageService, 'readListingDetails').mockResolvedValue({ status: 'unreachable' });

    const load = loadListingDetails('w1');

    expect(await load.cached).toEqual(details('Last visit'));
  });

  it('never answers from disk after the server has answered', async () => {
    await putCachedDetails('w1', details('Last visit'));
    vi.spyOn(WorldStorageService, 'readListingDetails').mockResolvedValue({ status: 'ok', details: details('Today') });

    const load = loadListingDetails('w1');

    expect(await load.cached).toBeNull();
  });

  it('does not store an answer read for a reader who has since changed', async () => {
    holdServer();

    const load = loadListingDetails('w1');
    await load.cached;
    reader = 'account-2';
    answer({ status: 'ok', details: details('For account 1') });
    await load.fresh;

    expect(await getCachedDetails('w1')).toBeNull();
    reader = 'account-1';
    expect(await getCachedDetails('w1')).toBeNull();
  });
});

describe('an open after a prefetch', () => {
  const page = (total: number) => ({ success: true, data: [], pagination: {}, total }) as never;

  it('waits for the prefetch in flight instead of asking again', async () => {
    const read = holdServer();
    const comments = vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue(page(4));

    prefetchListing('w1');
    const load = loadListingDetails('w1');
    const firstPage = takePrefetchedComments('w1');
    answer({ status: 'ok', details: details('Today') });

    expect(await load.fresh).toEqual({ status: 'ok', details: details('Today') });
    expect(await firstPage).toMatchObject({ total: 4 });
    expect(read).toHaveBeenCalledTimes(1);
    expect(comments).toHaveBeenCalledTimes(1);
  });

  it('takes a prefetch that answered moments ago, once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const read = vi.spyOn(WorldStorageService, 'readListingDetails').mockResolvedValue({ status: 'ok', details: details('Today') });
    vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue(page(4));

    prefetchListing('w1');
    await vi.waitFor(async () => expect(await getCachedDetails('w1')).toEqual(details('Today')));
    vi.setSystemTime(Date.now() + PREFETCH_REUSE_MS - 1000);

    expect(await loadListingDetails('w1').fresh).toEqual({ status: 'ok', details: details('Today') });
    expect(read).toHaveBeenCalledTimes(1);
    expect(takePrefetchedComments('w1')).not.toBeNull();

    // The next open reads fresh, and finds no comments held for it.
    await loadListingDetails('w1').fresh;
    expect(read).toHaveBeenCalledTimes(2);
    expect(takePrefetchedComments('w1')).toBeNull();
  });

  it('asks again when the prefetch answered too long ago', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const read = vi.spyOn(WorldStorageService, 'readListingDetails').mockResolvedValue({ status: 'ok', details: details('Today') });
    vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue(page(4));

    prefetchListing('w1');
    await vi.waitFor(async () => expect(await getCachedDetails('w1')).toEqual(details('Today')));
    vi.setSystemTime(Date.now() + PREFETCH_REUSE_MS + 1000);

    await loadListingDetails('w1').fresh;
    expect(read).toHaveBeenCalledTimes(2);
    expect(takePrefetchedComments('w1')).toBeNull();
  });

  it('asks again when the prefetch got no answer', async () => {
    const read = vi.spyOn(WorldStorageService, 'readListingDetails').mockResolvedValue({ status: 'unreachable' });
    const comments = vi.spyOn(WorldStorageService, 'fetchComments')
      .mockResolvedValue({ success: false, error: 'offline', data: [], total: 0, pagination: {} });

    prefetchListing('w1');
    await new Promise((resolve) => setTimeout(resolve, 0)); // let both reads settle
    expect(comments).toHaveBeenCalledTimes(1);

    expect(takePrefetchedComments('w1')).toBeNull();
    await loadListingDetails('w1').fresh;
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reads a failed comments page again on a re-hover, once the details are in hand', async () => {
    vi.spyOn(WorldStorageService, 'readListingDetails').mockResolvedValue({ status: 'ok', details: details('Today') });
    const comments = vi.spyOn(WorldStorageService, 'fetchComments')
      .mockResolvedValueOnce({ success: false, error: 'offline', data: [], total: 0, pagination: {} })
      .mockResolvedValue(page(4));

    prefetchListing('w1');
    await new Promise((resolve) => setTimeout(resolve, 0)); // let both reads settle
    prefetchListing('w1');

    expect(comments).toHaveBeenCalledTimes(2);
    expect(await takePrefetchedComments('w1')).toMatchObject({ total: 4 });
  });

  it('never writes a read that lands after a purge back to disk', async () => {
    holdServer();
    const load = loadListingDetails('w1');
    await load.cached;

    forgetListingPrefetch();
    answer({ status: 'ok', details: details('Before the purge') });
    await load.fresh;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await getCachedDetails('w1')).toBeNull();
  });

  it('drops a prefetch no open waits on when the community caches are purged', async () => {
    const read = holdServer();
    vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue(page(0));

    prefetchListing('w1');
    forgetListingPrefetch();

    expect((read.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
    expect(takePrefetchedComments('w1')).toBeNull();
  });

  it('keeps a prefetch an open waits on when another card prefetches', async () => {
    const read = holdServer();
    vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue(page(0));

    prefetchListing('w1');
    const load = loadListingDetails('w1');
    prefetchListing('w2');

    expect((read.mock.calls[0][1] as AbortSignal).aborted).toBe(false);
    answer({ status: 'ok', details: details('Today') });
    expect(await load.fresh).toEqual({ status: 'ok', details: details('Today') });
  });

  it('never hands one reader a prefetch read for another', async () => {
    const read = holdServer();
    vi.spyOn(WorldStorageService, 'fetchComments').mockResolvedValue(page(0));

    prefetchListing('w1');
    reader = 'account-2';

    expect(takePrefetchedComments('w1')).toBeNull();
    void loadListingDetails('w1');
    expect(read).toHaveBeenCalledTimes(2);
  });
});
