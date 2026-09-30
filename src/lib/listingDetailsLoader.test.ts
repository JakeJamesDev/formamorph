import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadListingDetails } from './listingDetailsLoader';
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
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await clearListingDetails();
});

afterEach(() => {
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
