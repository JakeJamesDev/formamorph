// Must load before the storage singleton, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { associatedWorlds, exportedComponentLinks } from './componentExportLinks';
import WorldStorageService from '@/services/WorldStorageService';
import type { Entity } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

/** Store one world holding `entities`, with the sections `storeWorld` insists on. */
async function storeWorld(
  id: string, name: string, entities: Entity[], over: { sourceId?: string } = {},
) {
  await WorldStorageService.storeWorld({
    id,
    name,
    author: 'Ann',
    ...over,
    data: {
      worldOverview: { name },
      stats: [], locations: [], traits: [], statUpdates: [],
      entities: entities as unknown as unknown[],
      dictionaries: [],
    },
  });
}

const copy = (over: Partial<Entity> = {}): Entity => ({
  id: 'copy-1', name: 'Sedge', link: { libraryId: 'lib-1', sourceName: 'Sedge' }, ...over,
});

describe('associatedWorlds', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  });

  it('names each published world holding a copy by its listing', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy()], { sourceId: 'listing-w1' });

    expect(await associatedWorlds('lib-1')).toEqual([{ id: 'listing-w1', name: 'Sedge Landing' }]);
  });

  it('leaves out a world with no listing, because an association has to mean something elsewhere', async () => {
    await storeWorld('w-1', 'Unpublished', [copy()]);

    expect(await associatedWorlds('lib-1')).toEqual([]);
  });

  it('names one world once however many copies of the item it holds', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy(), copy({ id: 'copy-2' })], { sourceId: 'listing-w1' });

    expect(await associatedWorlds('lib-1')).toHaveLength(1);
  });

  it('reads nothing for a copy that follows a different item', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy({ link: { libraryId: 'lib-2' } })], { sourceId: 'listing-w1' });

    expect(await associatedWorlds('lib-1')).toEqual([]);
  });
});

describe('exportedComponentLinks', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  });

  it('writes the source and the associations together', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy()], { sourceId: 'listing-w1' });

    expect(await exportedComponentLinks({ libraryId: 'lib-1', sourceName: 'Sedge' })).toEqual({
      source: { libraryId: 'lib-1', sourceName: 'Sedge' },
      associations: [{ id: 'listing-w1', name: 'Sedge Landing' }],
    });
  });

  it('writes nothing for an independent copy', async () => {
    expect(await exportedComponentLinks(undefined)).toEqual({});
  });
});
