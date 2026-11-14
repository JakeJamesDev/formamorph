// Must load before the storage singleton, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { affectedCopies } from './componentUpdateRun';
import WorldStorageService from '@/services/WorldStorageService';
import type { LibrarySource } from '@/lib/linkedContent';
import type { Entity, LibrarySupporterCopyMarker } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const source: LibrarySource = { id: 'lib-1', name: 'Sedge', revision: 'r2', owned: true };
const marker: LibrarySupporterCopyMarker = { listingId: 'L1', accountId: 'A1', revision: 1, sourceWorldId: 'w-source' };

const behind = (): Entity => ({
  id: 'copy-1', name: 'Sedge', link: { libraryId: 'lib-1', sourceRevision: 'r1' },
} as Entity);

async function storeWorld(id: string) {
  await WorldStorageService.storeWorld({
    id,
    name: id,
    author: 'Ann',
    data: {
      worldOverview: { name: id },
      stats: [], locations: [], traits: [], statUpdates: [],
      entities: [behind()] as unknown as unknown[],
      dictionaries: [],
      placeholders: [],
    },
  });
}

describe('an update review of a library item saved from a Supporter Copy', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
    await storeWorld('w-source');
    await storeWorld('w-other');
  });

  it('offers the copy in its source world only', async () => {
    const rows = await affectedCopies({ ...source, supporterCopy: marker });

    expect(rows.map((row) => row.worldId)).toEqual(['w-source']);
  });

  it('offers every world for an item with no marker', async () => {
    const rows = await affectedCopies(source);

    expect(rows.map((row) => row.worldId).sort()).toEqual(['w-other', 'w-source']);
  });
});
