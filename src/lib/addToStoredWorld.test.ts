// Must load before the storage singleton, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCopyToStoredWorld, storedWorldReferences } from './addToStoredWorld';
import WorldStorageService from '@/services/WorldStorageService';
import type { LibrarySource } from './linkedContent';
import type { ConnectionPlan } from './worldReferences';
import type { Dictionary, Entity, GameLocation, Placeholder } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const source: LibrarySource = { id: 'lib-1', name: 'Wren', revision: 'r1', owned: true };

const empty: ConnectionPlan = { placeholders: {}, locations: {}, newLocations: [], newPlaceholders: [] };

/** Store one world with the sections `storeWorld` insists on, plus whatever the case needs. */
async function storeWorld(over: {
  entities?: Entity[]; dictionaries?: Dictionary[]; placeholders?: Placeholder[]; locations?: GameLocation[];
  openingsEnabled?: boolean;
} = {}) {
  await WorldStorageService.storeWorld({
    id: 'w-1',
    name: 'Sedge Landing',
    author: 'Ann',
    data: {
      worldOverview: {
        name: 'Sedge Landing',
        ...(over.openingsEnabled === false ? { openingsEnabled: false } : {}),
      },
      stats: [], traits: [], statUpdates: [],
      entities: (over.entities ?? []) as unknown as unknown[],
      dictionaries: (over.dictionaries ?? []) as unknown as unknown[],
      placeholders: (over.placeholders ?? []) as unknown as unknown[],
      locations: (over.locations ?? []) as unknown as unknown[],
    },
  });
}

async function storedWorld(): Promise<{
  worldOverview?: { openingsEnabled?: boolean };
  entities?: Entity[]; dictionaries?: Dictionary[]; placeholders?: Placeholder[]; locations?: GameLocation[];
}> {
  return await WorldStorageService.getWorldData('w-1') as never;
}

describe('storedWorldReferences', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  });

  it('asks about a shared placeholder the content expects and the world has not got', async () => {
    await storeWorld();
    const content: Entity = {
      id: 'lib-content',
      name: 'Wren',
      aiDescription: 'Guide of {{ph:tone:world:p1}}.',
      sharedPlaceholders: [{ id: 'tone', name: 'Tone', values: [{ id: 'v1', text: 'dry' }] }],
    };

    const rows = await storedWorldReferences('w-1', content);

    expect(rows.map((row) => row.key)).toEqual(['tone']);
  });

  it('asks about nothing where the content expects nothing', async () => {
    await storeWorld();

    expect(await storedWorldReferences('w-1', { id: 'c', name: 'Wren' })).toEqual([]);
  });
});

describe('addCopyToStoredWorld', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  });

  it('writes a linked copy that follows the library item', async () => {
    await storeWorld();

    await addCopyToStoredWorld('w-1', { id: 'lib-content', name: 'Wren' }, source, empty);
    const data = await storedWorld();

    expect(data.entities).toHaveLength(1);
    expect(data.entities?.[0].link).toMatchObject({ libraryId: 'lib-1', sourceName: 'Wren', sourceRevision: 'r1' });
  });

  it('gives the copy its own id, so importing the same component twice leaves two copies', async () => {
    await storeWorld();
    const content: Entity = { id: 'lib-content', name: 'Wren' };

    await addCopyToStoredWorld('w-1', content, source, empty);
    await addCopyToStoredWorld('w-1', content, source, empty);
    const data = await storedWorld();

    expect(data.entities).toHaveLength(2);
    expect(data.entities?.[0].id).not.toBe(data.entities?.[1].id);
    expect(data.entities?.[0].id).not.toBe('lib-content');
  });

  it('keeps the world\'s own content beside the copy', async () => {
    await storeWorld({ entities: [{ id: 'held', name: 'Ash' }] });

    await addCopyToStoredWorld('w-1', { id: 'lib-content', name: 'Wren' }, source, empty);
    const data = await storedWorld();

    expect(data.entities?.map((item) => item.name)).toEqual(['Ash', 'Wren']);
  });

  it('points the copy\'s chips at the placeholder the plan answered with, and records the connection', async () => {
    await storeWorld({ placeholders: [{ id: 'ours', name: 'Tone', values: [{ id: 'v', text: 'dry' }] }] });
    const content: Entity = {
      id: 'lib-content',
      name: 'Wren',
      aiDescription: 'Guide of {{ph:theirs:world:p1}}.',
      sharedPlaceholders: [{ id: 'theirs', name: 'Tone', values: [{ id: 'v1', text: 'dry' }] }],
    };

    await addCopyToStoredWorld('w-1', content, source, { ...empty, placeholders: { theirs: 'ours' } });
    const data = await storedWorld();

    expect(data.entities?.[0].aiDescription).toBe('Guide of {{ph:ours:world:p1}}.');
    expect(data.entities?.[0].link?.connections).toMatchObject({ theirs: 'ours' });
    // The world's list is unchanged: the copy resolved to a placeholder it already had.
    expect(data.placeholders).toHaveLength(1);
  });

  it('gives the world the placeholder a reference nobody answered for needs', async () => {
    await storeWorld();
    const content: Entity = {
      id: 'lib-content',
      name: 'Wren',
      aiDescription: 'Guide of {{ph:theirs:world:p1}}.',
      sharedPlaceholders: [{ id: 'theirs', name: 'Tone', values: [{ id: 'v1', text: 'dry' }] }],
    };

    await addCopyToStoredWorld('w-1', content, source, empty);
    const data = await storedWorld();

    expect(data.placeholders).toHaveLength(1);
    expect(data.placeholders?.[0].name).toBe('Tone');
  });

  it('writes a dictionary into the world\'s books rather than its characters', async () => {
    await storeWorld();

    await addCopyToStoredWorld('w-1', { id: 'lib-book', name: 'Marsh Lore', entries: [] }, source, empty);
    const data = await storedWorld();

    expect(data.dictionaries).toHaveLength(1);
    expect(data.entities).toHaveLength(0);
  });

  it('places the copy at the location the plan created for it', async () => {
    await storeWorld();
    const content: Entity = {
      id: 'lib-content',
      name: 'Wren',
      locationRefs: [{ id: 'their-marsh', name: 'The Marsh' }],
    };
    const marsh: GameLocation = { id: 'our-marsh', name: 'The Marsh' };

    await addCopyToStoredWorld('w-1', content, source, {
      ...empty, locations: { 'their-marsh': 'our-marsh' }, newLocations: [marsh],
    });
    const data = await storedWorld();

    expect(data.locations?.map((place) => place.id)).toEqual(['our-marsh']);
    expect(data.entities?.[0].locations).toEqual(['our-marsh']);
    expect(data.entities?.[0].link?.connections).toMatchObject({ 'their-marsh': 'our-marsh' });
  });

  it('drops a membership the world cannot place rather than pointing at a location it has not got', async () => {
    await storeWorld();
    const content: Entity = {
      id: 'lib-content', name: 'Wren', locationRefs: [{ id: 'their-marsh', name: 'The Marsh' }],
    };

    await addCopyToStoredWorld('w-1', content, source, empty);
    const data = await storedWorld();

    expect(data.entities?.[0].locations ?? []).toEqual([]);
    expect(data.locations).toHaveLength(0);
  });

  it('refuses a world that is gone rather than writing anywhere else', async () => {
    await expect(addCopyToStoredWorld('missing', { id: 'c', name: 'Wren' }, source, empty))
      .rejects.toThrow();
  });
});

describe('a copy that brings openings', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  });

  const opener = (text: string): Entity => ({
    id: 'lib-o',
    name: 'Tall Marn',
    openings: [{ id: 'o1', text, kind: 'action' }],
  });

  it('switches a benched list back on, so the arriving rows can draw', async () => {
    await storeWorld({ openingsEnabled: false });

    await addCopyToStoredWorld('w-1', opener('Marn hails you from the jetty.'), source, empty);

    expect((await storedWorld()).worldOverview?.openingsEnabled).toBeUndefined();
  });

  it('leaves the switch alone for a copy with no row that could come up', async () => {
    await storeWorld({ openingsEnabled: false });

    await addCopyToStoredWorld('w-1', opener('   '), source, empty);

    expect((await storedWorld()).worldOverview?.openingsEnabled).toBe(false);
  });
});
