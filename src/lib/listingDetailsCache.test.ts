import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_CACHED_DETAILS, clearListingDetails, dropCachedDetails, getCachedDetails, putCachedDetails,
} from './listingDetailsCache';
import type { ListingDetails } from '@/services/WorldStorageService';

let reader = 'account-1';
vi.mock('@/lib/currentReader', () => ({ currentReader: () => reader }));

const details = (title: string): ListingDetails => ({
  changelog: [{
    id: title, world_id: 'w1', title, body: 'Changed.', entry_date: '2026-08-01',
    created_at: '2026-08-01T12:00:00.000Z', updated_at: '2026-08-01T12:00:00.000Z',
  }],
  anonymousLikes: false,
  visibility: 'public',
  requiredDependencies: [],
  compatibleWorlds: [],
});

beforeEach(async () => {
  reader = 'account-1';
  await clearListingDetails();
});

describe('the listing details cache', () => {
  it('hands back exactly what was stored', async () => {
    await putCachedDetails('w1', details('Update 1'));

    expect(await getCachedDetails('w1')).toEqual(details('Update 1'));
  });

  it('answers null for a listing it has never held', async () => {
    expect(await getCachedDetails('w1')).toBeNull();
  });

  it('never shows one reader what another reader cached', async () => {
    await putCachedDetails('w1', details('Seen by account 1'));

    reader = 'install:guest-copy';
    expect(await getCachedDetails('w1')).toBeNull();

    reader = 'account-2';
    expect(await getCachedDetails('w1')).toBeNull();

    reader = 'account-1';
    expect(await getCachedDetails('w1')).toEqual(details('Seen by account 1'));
  });

  it('drops only this reader’s entry', async () => {
    await putCachedDetails('w1', details('Account 1'));
    reader = 'account-2';
    await putCachedDetails('w1', details('Account 2'));

    await dropCachedDetails('w1');

    expect(await getCachedDetails('w1')).toBeNull();
    reader = 'account-1';
    expect(await getCachedDetails('w1')).toEqual(details('Account 1'));
  });

  it('evicts the least recently stored entry past the cap', async () => {
    for (let i = 0; i <= MAX_CACHED_DETAILS; i++) await putCachedDetails(`w${i}`, details(`Update ${i}`));

    expect(await getCachedDetails('w0')).toBeNull();
    expect(await getCachedDetails('w1')).not.toBeNull();
    expect(await getCachedDetails(`w${MAX_CACHED_DETAILS}`)).not.toBeNull();
  });

  it('keeps an entry that was read since, and evicts the coldest one instead', async () => {
    for (let i = 0; i < MAX_CACHED_DETAILS; i++) await putCachedDetails(`w${i}`, details(`Update ${i}`));

    await getCachedDetails('w0');
    await putCachedDetails('overflow', details('Overflow'));

    expect(await getCachedDetails('w0')).not.toBeNull();
    expect(await getCachedDetails('w1')).toBeNull();
  });

  it('empties on clear, for every reader', async () => {
    await putCachedDetails('w1', details('Account 1'));
    reader = 'account-2';
    await putCachedDetails('w1', details('Account 2'));

    await clearListingDetails();

    expect(await getCachedDetails('w1')).toBeNull();
    reader = 'account-1';
    expect(await getCachedDetails('w1')).toBeNull();
  });
});
