// @vitest-environment jsdom
// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import WorldStorageService, { type StoredWorldRecord } from './WorldStorageService';
import { WORLD_STORE } from '@/lib/worldLibrary';
import { failWritesOnQuota } from '@/test/quotaAbort';

/**
 * Guards what a full disk does to a world write: the write rejects with the browser's own error, never stays
 * pending, and leaves the stored world as it was.
 */

const world = (id: string, name: string): StoredWorldRecord => ({
  id, name, description: '', author: '', thumbnail: '',
  data: { worldOverview: { name }, stats: [], locations: [], entities: [], traits: [], statUpdates: [] },
});

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

describe('a world write on a full disk', () => {
  it('rejects storeWorld with the QuotaExceededError and keeps the stored world', async () => {
    await WorldStorageService.storeWorld(world('q-1', 'Before'));
    restore = failWritesOnQuota(WORLD_STORE);

    await expect(WorldStorageService.storeWorld(world('q-1', 'After')))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });

    restore();
    restore = null;
    expect(await WorldStorageService.getWorldData('q-1')).toMatchObject({ worldOverview: { name: 'Before' } });
    expect((await WorldStorageService.getWorldMetadata()).find((m) => m.id === 'q-1')?.name).toBe('Before');
  });

  it('rejects updateWorldContent with the QuotaExceededError', async () => {
    await WorldStorageService.storeWorld(world('q-2', 'Before'));
    restore = failWritesOnQuota(WORLD_STORE);

    await expect(WorldStorageService.updateWorldContent('q-2', (data) => ({ ...data, stats: [{ id: 's' }] })))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
  });

  it('rejects linkWorldToListing with the QuotaExceededError', async () => {
    await WorldStorageService.storeWorld(world('q-3', 'Before'));
    restore = failWritesOnQuota(WORLD_STORE);

    await expect(WorldStorageService.linkWorldToListing('q-3', 'listing-1'))
      .rejects.toMatchObject({ name: 'QuotaExceededError' });
  });
});
