// Must load before the storage singleton, whose first use opens IndexedDB.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { affectedCopies, applyUpdate, type LiveWorld } from './componentUpdateRun';
import WorldStorageService from '@/services/WorldStorageService';
import type { LibrarySource } from '@/lib/linkedContent';
import type { ContentLink, Dictionary, Entity, Placeholder } from '@/types';

vi.mock('@/services/AuthService', () => ({ default: { getCurrentUser: () => null } }));

const source: LibrarySource = { id: 'lib-1', name: 'Sedge', revision: 'r2', owned: true };

const sourceData = (over: Partial<Entity> = {}): Entity => ({
  id: 'lib-content', name: 'Sedge', aiDescription: "The author's latest.", ...over,
});

const copy = (link: ContentLink, over: Partial<Entity> = {}): Entity => ({
  id: 'copy-1', name: 'Sedge', aiDescription: 'What this world holds.', link, ...over,
});

/** Store one world holding `entities`, with the sections `storeWorld` insists on. */
async function storeWorld(id: string, name: string, entities: Entity[], placeholders: Placeholder[] = []) {
  await WorldStorageService.storeWorld({
    id,
    name,
    author: 'Ann',
    data: {
      worldOverview: { name },
      stats: [], locations: [], traits: [], statUpdates: [],
      entities: entities as unknown as unknown[],
      dictionaries: [],
      placeholders: placeholders as unknown as unknown[],
    },
  });
}

/** One world's stored entities, read back. */
async function storedEntities(id: string): Promise<Entity[]> {
  const data = await WorldStorageService.getWorldData(id) as { entities: Entity[] };
  return data.entities;
}

describe('affectedCopies', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  });

  it('finds a copy behind the source and names the world holding it', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);

    expect(await affectedCopies(source)).toEqual([{
      worldId: 'w-1', worldName: 'Sedge Landing', itemId: 'copy-1', itemName: 'Sedge',
      kind: 'entity', state: 'linked',
    }]);
  });

  it('reports a local replacement in its own state', async () => {
    await storeWorld('w-1', 'Sedge Landing', [
      copy({ libraryId: 'lib-1', sourceRevision: 'r1', localReplacement: true }),
    ]);

    expect((await affectedCopies(source))[0].state).toBe('local-replacement');
  });

  it('omits a copy already at the source revision, one that kept it, and an independent copy', async () => {
    await storeWorld('w-1', 'Up To Date', [copy({ libraryId: 'lib-1', sourceRevision: 'r2' })]);
    await storeWorld('w-2', 'Kept', [
      copy({ libraryId: 'lib-1', sourceRevision: 'r1', reviewedRevision: 'r2' }, { id: 'copy-2' }),
    ]);
    await storeWorld('w-3', 'Independent', [{ id: 'copy-3', name: 'Sedge' }]);

    expect(await affectedCopies(source)).toEqual([]);
  });

  it('reads the open world from the editor rather than from storage, and lists it first', async () => {
    // The editor holds a link the last save did not, so storage still shows the copy unlinked.
    await storeWorld('w-open', 'Open World', [{ id: 'copy-live', name: 'Sedge' }]);
    await storeWorld('w-other', 'Other World', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);
    const live: LiveWorld = {
      id: 'w-open',
      name: 'Open World',
      entities: [copy({ libraryId: 'lib-1', sourceRevision: 'r1' }, { id: 'copy-live' })],
      dictionaries: [],
      placeholders: [],
      writeItem: vi.fn(),
      addPlaceholder: vi.fn(),
    };

    expect((await affectedCopies(source, [live])).map((row) => row.worldName))
      .toEqual(['Open World', 'Other World']);
  });

  it('lists a dictionary copy under its own kind', async () => {
    const book = {
      id: 'book-1', name: 'Marsh Lore', entries: [], link: { libraryId: 'lib-1', sourceRevision: 'r1' },
    } as Dictionary;
    await WorldStorageService.storeWorld({
      id: 'w-1',
      name: 'Sedge Landing',
      data: {
        worldOverview: { name: 'Sedge Landing' },
        stats: [], locations: [], traits: [], statUpdates: [], entities: [],
        dictionaries: [book] as unknown as unknown[],
      },
    });

    expect((await affectedCopies(source))[0].kind).toBe('dictionary');
  });
});

describe('applyUpdate', () => {
  beforeEach(async () => {
    for (const id of await WorldStorageService.getWorldIds()) await WorldStorageService.deleteWorld(id);
  });

  it('rewrites a stored copy to the source content and holds its revision', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);
    const [row] = await affectedCopies(source);

    await applyUpdate(row, 'update', source, sourceData());

    const [written] = await storedEntities('w-1');
    expect(written.aiDescription).toBe("The author's latest.");
    expect(written.id).toBe('copy-1');
    expect(written.link).toMatchObject({ libraryId: 'lib-1', sourceRevision: 'r2' });
    expect(await affectedCopies(source)).toEqual([]);
  });

  it('leaves the record every wrapper field it had', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);
    const [row] = await affectedCopies(source);

    await applyUpdate(row, 'update', source, sourceData());

    const [record] = (await WorldStorageService.getWorldMetadata()).filter((w) => w.id === 'w-1');
    expect(record.author).toBe('Ann');
  });

  it('keeps the content on Keep Mine and does not offer that revision again', async () => {
    await storeWorld('w-1', 'Sedge Landing', [
      copy({ libraryId: 'lib-1', sourceRevision: 'r1', localReplacement: true }),
    ]);
    const [row] = await affectedCopies(source);

    await applyUpdate(row, 'keep', source, sourceData());

    const [written] = await storedEntities('w-1');
    expect(written.aiDescription).toBe('What this world holds.');
    expect(written.link).toMatchObject({ reviewedRevision: 'r2', localReplacement: true });
    expect(await affectedCopies(source)).toEqual([]);
    expect(await affectedCopies({ ...source, revision: 'r3' })).toHaveLength(1);
  });

  it('leaves an independent copy with unchanged content on Unlink', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);
    const [row] = await affectedCopies(source);

    await applyUpdate(row, 'unlink', source, sourceData());

    const [written] = await storedEntities('w-1');
    expect(written.aiDescription).toBe('What this world holds.');
    expect(written.link).toBeUndefined();
    expect(await affectedCopies(source)).toEqual([]);
  });

  it('keeps one world when another fails, so the batch is not all or nothing', async () => {
    await storeWorld('w-good', 'Good World', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);
    await storeWorld('w-gone', 'Gone World', [
      copy({ libraryId: 'lib-1', sourceRevision: 'r1' }, { id: 'copy-gone' }),
    ]);
    const rows = await affectedCopies(source);
    const gone = rows.find((row) => row.worldId === 'w-gone')!;
    const good = rows.find((row) => row.worldId === 'w-good')!;
    // The other world lost the copy while the review was open.
    await storeWorld('w-gone', 'Gone World', [{ id: 'someone-else', name: 'Other' }]);

    await applyUpdate(good, 'update', source, sourceData());
    await expect(applyUpdate(gone, 'update', source, sourceData())).rejects.toThrow(/no longer in Gone World/);

    expect((await storedEntities('w-good'))[0].aiDescription).toBe("The author's latest.");
    expect((await storedEntities('w-gone'))[0].name).toBe('Other');
  });

  it('refuses an update whose source content is gone and leaves the copy alone', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);
    const [row] = await affectedCopies(source);

    await expect(applyUpdate(row, 'update', source, null)).rejects.toThrow(/no longer in your library/);

    expect((await storedEntities('w-1'))[0].aiDescription).toBe('What this world holds.');
  });

  it('writes the open world through the editor rather than to storage', async () => {
    await storeWorld('w-open', 'Open World', [{ id: 'copy-live', name: 'Sedge' }]);
    const writeItem = vi.fn();
    const live: LiveWorld = {
      id: 'w-open',
      name: 'Open World',
      entities: [copy({ libraryId: 'lib-1', sourceRevision: 'r1' }, { id: 'copy-live' })],
      dictionaries: [],
      placeholders: [],
      writeItem,
      addPlaceholder: vi.fn(),
    };
    const [row] = await affectedCopies(source, [live]);

    await applyUpdate(row, 'update', source, sourceData(), [live]);

    expect(writeItem).toHaveBeenCalledTimes(1);
    expect(writeItem.mock.calls[0][0]).toMatchObject({ id: 'copy-live', aiDescription: "The author's latest." });
    // Storage still holds what the last world save wrote.
    expect((await storedEntities('w-open'))[0].link).toBeUndefined();
  });

  it('gives the world the placeholders a new source reference needs', async () => {
    await storeWorld('w-1', 'Sedge Landing', [copy({ libraryId: 'lib-1', sourceRevision: 'r1' })]);
    const [row] = await affectedCopies(source);
    const shared: Placeholder = { id: 'src-tide', name: 'Tide', values: [{ id: 'v1', text: 'high' }] };

    await applyUpdate(row, 'update', source, sourceData({ sharedPlaceholders: [shared] }));

    const data = await WorldStorageService.getWorldData('w-1') as { placeholders: Placeholder[] };
    expect(data.placeholders.map((p) => p.name)).toEqual(['Tide']);
  });
});
