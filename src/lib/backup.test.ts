// Must load before importing anything that opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The worker's own op, run in-process: jsdom and node have no Worker.
vi.mock('@/lib/jsonFileWorkerUtils', async () => {
  const { runJsonFileOp } = await import('@/lib/jsonFileOps');
  return {
    indexBackupInWorker: (file: Blob) => runJsonFileOp({ op: 'indexBackup', file }),
    restoreBackupInWorker: (request: RestoreRequest, onProgress?: (done: number) => void) =>
      runJsonFileOp({ op: 'restoreBackup', request }, onProgress as (p: unknown) => void),
    serializeJsonBlobSplit: vi.fn(),
  };
});
import {
  readBackupIndex, splitByConflict, BACKUP_CATEGORIES, itemLabel,
  buildBackup, listBackupItems, analyzeBackup, applyBackup, restoreBackup,
  type BackupBundle, type BackupIndex, type RestoreRequest,
} from '@/lib/backup';
import { promisifyRequest } from '@/lib/idb';
import { jsonParts } from '@/lib/jsonFileOps';
import { STORE_TARGETS, type StoreTarget } from '@/lib/backupRestore';
import {
  WORLD_LIBRARY_DB, WORLD_META_STORE, WORLD_STORE, transactionDone, worldMetaOf, type WorldMetaRecord,
} from '@/lib/worldLibrary';

/** The file `saveBackup` writes for a bundle. */
const backupFile = (bundle: unknown) => new Blob(jsonParts(bundle, 3));
const indexOf = (value: unknown) => readBackupIndex(new Blob([JSON.stringify(value)]));

/** A Blob whose `text()` fails past `max` bytes, as V8 does past its maximum string length. */
const limitedBlob = (blob: Blob, max: number): Blob =>
  ({
    size: blob.size,
    slice: (start?: number, end?: number) => limitedBlob(blob.slice(start, end), max),
    arrayBuffer: () => blob.arrayBuffer(),
    text: () => (blob.size > max ? Promise.reject(new RangeError('Invalid string length')) : blob.text()),
  }) as unknown as Blob;

const NO_OVERWRITE = { worlds: false, saves: false, entities: false, dictionaries: false };

describe('splitByConflict', () => {
  it('separates fresh ids from ones already present', () => {
    const incoming = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const { fresh, conflicts } = splitByConflict(incoming, new Set(['b']));
    expect(fresh.map((r) => r.id)).toEqual(['a', 'c']);
    expect(conflicts.map((r) => r.id)).toEqual(['b']);
  });

  it('treats everything as fresh when nothing exists', () => {
    const { fresh, conflicts } = splitByConflict([{ id: 'x' }], new Set());
    expect(fresh).toHaveLength(1);
    expect(conflicts).toHaveLength(0);
  });
});

describe('readBackupIndex', () => {
  it('rejects non-JSON', async () => {
    await expect(readBackupIndex(new Blob(['{ not json']))).rejects.toThrow(/valid JSON/);
    await expect(readBackupIndex(new Blob(['<!doctype html><html></html>']))).rejects.toThrow(/valid JSON/);
  });

  it('rejects a record that is not valid JSON', async () => {
    await expect(
      readBackupIndex(new Blob(['{"formamorphBackup":1,"data":{"worlds":[{"id":"w1",}]}}'])),
    ).rejects.toThrow(/valid JSON/);
  });

  it('rejects JSON that is not a Formamorph backup', async () => {
    await expect(indexOf({ hello: 'world' })).rejects.toThrow(/not a Formamorph backup/);
    await expect(indexOf({ formamorphBackup: 1 })).rejects.toThrow(/not a Formamorph backup/);
    await expect(indexOf([1])).rejects.toThrow(/not a Formamorph backup/);
  });

  it('normalizes missing categories to empty arrays and drops id-less records', async () => {
    const index = await indexOf({ formamorphBackup: 1, data: { worlds: [{ id: 'w1' }, { name: 'no id' }, null] } });
    expect(index.data.worlds.map((r) => r.id)).toEqual(['w1']);
    for (const cat of BACKUP_CATEGORIES) expect(Array.isArray(index.data[cat])).toBe(true);
    expect(index.data.saves).toEqual([]);
  });

  it('labels each record and counts its images', async () => {
    const world = {
      worldOverview: { thumbnail: 'data:image/png;base64,AA' },
      entities: [{ id: 'e1', images: ['data:image/png;base64,AA', 'data:image/png;base64,BB'] }],
      locations: [{ id: 'l1', backgroundImage: 'data:image/png;base64,CC' }, { id: 'l2' }],
    };
    const index = await indexOf({
      formamorphBackup: 1,
      data: {
        worlds: [{ id: 'w1', name: 'Sedge Landing', data: world }],
        entities: [{ id: 'e1', data: { images: ['data:image/png;base64,AA'] } }],
        dictionaries: [{ id: 'd1', data: world }],
      },
    });
    expect(index.data.worlds[0]).toMatchObject({ id: 'w1', label: 'Sedge Landing', images: 4 });
    expect(index.data.entities[0]).toMatchObject({ id: 'e1', label: 'e1', images: 1 });
    expect(index.data.dictionaries[0].images).toBe(0);
  });

  it('gives a save its world as a breadcrumb, and no other record one', async () => {
    const index = await indexOf({
      formamorphBackup: 1,
      data: {
        saves: [
          { id: 's1', name: 'Turn 8', currentState: { worldName: 'Sedge Landing' } },
          { id: 's2', name: 'Orphan', currentState: { worldName: null } },
        ],
        worlds: [{ id: 'w1', name: 'Sedge Landing', currentState: { worldName: 'Elsewhere' } }],
      },
    });
    expect(index.data.saves.map((r) => r.breadcrumb)).toEqual([['Sedge Landing'], undefined]);
    expect(index.data.worlds[0].breadcrumb).toBeUndefined();
  });

  it('keeps reading a bundle written by a newer app version', async () => {
    // Readers warn on a newer format but still try — a backup must not become unreadable.
    const index = await indexOf({ formamorphBackup: 99, data: { worlds: [{ id: 'w1' }] } });
    expect(index.formamorphBackup).toBe(99);
    expect(index.data.worlds).toHaveLength(1);
  });

  it('defaults a bundle missing its metadata rather than throwing', async () => {
    const index = await indexOf({ formamorphBackup: 1, data: {} });
    expect(index.appVersion).toBe('unknown');
    expect(index.exportedAt).toBe('');
  });
});

describe('itemLabel', () => {
  it('prefers the name', () => {
    expect(itemLabel({ id: 'w1', name: 'Sedge Landing' })).toBe('Sedge Landing');
  });

  it('falls back to the id when the name is absent or blank', () => {
    expect(itemLabel({ id: 'w1' })).toBe('w1');
    expect(itemLabel({ id: 'w1', name: '' })).toBe('w1');
    expect(itemLabel({ id: 'w1', name: 42 })).toBe('w1'); // a non-string name is not a label
  });
});

/** The backup target that owns `dbName`, so each database opens at its current version. */
const targetOf = (dbName: string): StoreTarget => Object.values(STORE_TARGETS).find((t) => t.db === dbName)!;

/** Seed a store through its target's own write, as a restore does. Worlds get their metadata. */
async function seed(dbName: string, _store: string, records: { id: string; name?: string }[]) {
  const target = targetOf(dbName);
  const db = await target.open();
  await target.write(db, records);
  db.close();
}

async function readAll<T = { id: string; name?: string }>(dbName: string, store: string): Promise<T[]> {
  const db = await targetOf(dbName).open();
  const out = await promisifyRequest<T[]>(db.transaction([store], 'readonly').objectStore(store).getAll());
  db.close();
  return out;
}

/**
 * Empty a store rather than delete its database: `dbUtils` never closes the connections it opens, and a
 * leaked handle blocks `deleteDatabase` indefinitely. The world library empties its metadata store too.
 */
async function wipe(dbName: string, store: string) {
  const db = await targetOf(dbName).open();
  const stores = dbName === WORLD_LIBRARY_DB ? [WORLD_STORE, WORLD_META_STORE] : [store];
  const tx = db.transaction(stores, 'readwrite');
  for (const name of stores) tx.objectStore(name).clear();
  await transactionDone(tx);
  db.close();
}

const STORES: [string, string][] = [
  ['worldsDB', 'worlds'],
  ['entitiesDB', 'entities'],
  ['dictionariesDB', 'dictionaries'],
];

const worldsIndex = (worlds: { id: string; name: string }[]): Promise<BackupIndex> =>
  indexOf({ formamorphBackup: 1, data: { worlds } });

/** Run `applyBackup` and record which records it read. */
async function applyRecording(index: BackupIndex, overwrite = NO_OVERWRITE) {
  const read: string[] = [];
  const result = await applyBackup(index, await analyzeBackup(index), overwrite, async (_, record) => {
    read.push(record.id);
    return record;
  });
  return { result, read };
}

describe('backup round trip (IndexedDB)', () => {
  beforeEach(async () => {
    for (const [db, store] of STORES) await wipe(db, store);
  });

  it('lists every store’s items with display labels', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Sedge Landing' }]);
    await seed('entitiesDB', 'entities', [{ id: 'e1', name: 'Mara' }]);

    const items = await listBackupItems();
    expect(items.worlds).toEqual([{ id: 'w1', label: 'Sedge Landing' }]);
    expect(items.entities).toEqual([{ id: 'e1', label: 'Mara' }]);
    expect(items.dictionaries).toEqual([]);
  });

  it('exports only the selected ids', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Keep' }, { id: 'w2', name: 'Drop' }]);
    await seed('entitiesDB', 'entities', [{ id: 'e1', name: 'Mara' }]);

    // entities unselected entirely; only w1 of the two worlds.
    const bundle = await buildBackup({ worlds: new Set(['w1']) });

    expect(bundle.data.worlds.map((r) => r.id)).toEqual(['w1']);
    expect(bundle.data.entities).toEqual([]); // an unselected category exports nothing
    expect(bundle.formamorphBackup).toBe(1);
  });

  it('treats an empty selection set as “none from that category”', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1' }]);
    const bundle = await buildBackup({ worlds: new Set() });
    expect(bundle.data.worlds).toEqual([]);
  });

  it('restores a bundle into empty storage — the orphaned-origin recovery path', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Sedge Landing' }]);
    await seed('dictionariesDB', 'dictionaries', [{ id: 'd1', name: 'Lore' }]);
    const bundle = await buildBackup({ worlds: new Set(['w1']), dictionaries: new Set(['d1']) });

    // The new origin: nothing stored at all.
    await wipe('worldsDB', 'worlds');
    await wipe('dictionariesDB', 'dictionaries');

    const index = await readBackupIndex(backupFile(bundle));
    const result = await applyBackup(index, await analyzeBackup(index), NO_OVERWRITE);

    expect(result.worlds).toEqual({ added: 1, overwritten: 0, skipped: 0 });
    expect(await readAll('worldsDB', 'worlds')).toEqual([{ id: 'w1', name: 'Sedge Landing' }]);
    expect(await readAll('dictionariesDB', 'dictionaries')).toEqual([{ id: 'd1', name: 'Lore' }]);
  });

  it('splits fresh from conflicting ids against what is already stored', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Mine' }]);
    const index = await worldsIndex([{ id: 'w1', name: 'Theirs' }, { id: 'w2', name: 'New' }]);

    const worlds = (await analyzeBackup(index)).find((p) => p.category === 'worlds')!;
    expect(worlds.fresh.map((r) => r.id)).toEqual(['w2']);
    expect(worlds.conflicts.map((r) => r.id)).toEqual(['w1']);
  });

  it('keeps the stored copy, unread, when a conflicting category is not set to overwrite', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Mine' }]);
    const index = await worldsIndex([{ id: 'w2', name: 'New' }, { id: 'w1', name: 'Theirs' }]);

    const { result, read } = await applyRecording(index);

    expect(result.worlds).toEqual({ added: 1, overwritten: 0, skipped: 1 });
    expect(read).toEqual(['w2']);
    const stored = await readAll('worldsDB', 'worlds');
    expect(stored.find((r) => r.id === 'w1')?.name).toBe('Mine'); // not clobbered
    expect(stored.find((r) => r.id === 'w2')?.name).toBe('New'); // fresh still lands
  });

  it('replaces the stored copy when the category is set to overwrite', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Mine' }]);
    const index = await worldsIndex([{ id: 'w1', name: 'Theirs' }]);

    const result = await applyBackup(index, await analyzeBackup(index), { ...NO_OVERWRITE, worlds: true });

    expect(result.worlds).toEqual({ added: 0, overwritten: 1, skipped: 0 });
    expect((await readAll('worldsDB', 'worlds')).find((r) => r.id === 'w1')?.name).toBe('Theirs');
  });

  it('restores a file too large to read as one string, one record at a time', async () => {
    const bundle: BackupBundle = {
      formamorphBackup: 1,
      appVersion: 'test',
      exportedAt: '',
      data: {
        worlds: [1, 2, 3].map((n) => ({ id: `w${n}`, name: `World ${n}`, data: 'x'.repeat(200) })),
        saves: [],
        entities: [],
        dictionaries: [],
      },
    };
    const whole = backupFile(bundle);
    // Every record fits under the limit; the file as a whole does not.
    expect(whole.size).toBeGreaterThan(400);

    const { result, read } = await applyRecording(await readBackupIndex(limitedBlob(whole, 400)));

    expect(result.worlds).toEqual({ added: 3, overwritten: 0, skipped: 0 });
    expect(read).toEqual(['w1', 'w2', 'w3']);
    expect(await readAll('worldsDB', 'worlds')).toEqual(bundle.data.worlds);
  });

  it('restores only the ticked entries through the worker op', async () => {
    const index = await worldsIndex([{ id: 'w1', name: 'Keep' }, { id: 'w2', name: 'Skip' }]);
    const plans = (await analyzeBackup(index)).map((p) => ({ ...p, fresh: p.fresh.filter((e) => e.id === 'w1') }));
    const request: RestoreRequest = {
      index, plans, overwrite: NO_OVERWRITE, modes: {}, webpSupported: false,
    };

    const result = await restoreBackup(request);

    expect(result.worlds).toEqual({ added: 1, overwritten: 0, skipped: 0 });
    expect(await readAll('worldsDB', 'worlds')).toEqual([{ id: 'w1', name: 'Keep' }]);
    // The worker writes each world's metadata beside it, so the library lists exactly what was restored.
    expect(await readAll(WORLD_LIBRARY_DB, WORLD_META_STORE)).toEqual([worldMetaOf({ id: 'w1', name: 'Keep' })]);
  });

  it('round-trips worlds and their metadata through a backup and a restore', async () => {
    const link = { libraryId: 'lib-1', sourceName: 'Mara' };
    const worlds = [
      {
        id: 'w1', name: 'Sedge Landing', description: 'Reeds.', author: 'Ann', thumbnail: 'data:image/png;base64,AAA',
        sourceId: 'srv-1', dirty: true, createdAt: '2026-01-01T00:00:00.000Z',
        data: { worldOverview: { tags: ['marsh'] }, entities: [{ id: 'e1', name: 'Mara', link }], dictionaries: [] },
      },
      { id: 'w2', name: 'Salt Reach', data: { worldOverview: {}, entities: [] } },
    ];
    await seed(WORLD_LIBRARY_DB, WORLD_STORE, worlds);
    const bundle = await buildBackup({ worlds: new Set(['w1', 'w2']) });
    await wipe(WORLD_LIBRARY_DB, WORLD_STORE);

    const index = await readBackupIndex(backupFile(bundle));
    await restoreBackup({
      index, plans: await analyzeBackup(index), overwrite: NO_OVERWRITE, modes: {}, webpSupported: false,
    });

    expect(await readAll(WORLD_LIBRARY_DB, WORLD_STORE)).toEqual(worlds);
    const meta = await readAll<WorldMetaRecord>(WORLD_LIBRARY_DB, WORLD_META_STORE);
    expect(meta).toEqual(worlds.map(worldMetaOf));
    expect(meta[0]).toMatchObject({
      name: 'Sedge Landing', tags: ['marsh'], sourceId: 'srv-1', dirty: true,
      linkedCopies: [{ itemId: 'e1', itemName: 'Mara', kind: 'entity', link }],
    });
    const getAll = IDBObjectStore.prototype.getAll;
    const wholeReads: string[] = [];
    vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args) {
      wholeReads.push(this.name);
      return getAll.apply(this, args);
    });
    expect(await listBackupItems().then((items) => items.worlds)).toEqual([
      { id: 'w1', label: 'Sedge Landing' }, { id: 'w2', label: 'Salt Reach' },
    ]);
    await analyzeBackup(index);
    // The checklist and the conflict split list worlds from metadata, never from the world records.
    expect(wholeReads).toContain(WORLD_META_STORE);
    expect(wholeReads).not.toContain(WORLD_STORE);
    vi.restoreAllMocks();
  });

  it('reports image progress across records while it optimizes', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const world = {
      worldOverview: { thumbnail: png },
      entities: [{ id: 'e1', images: [png] }],
      locations: [{ id: 'l1', backgroundImage: png }],
    };
    const index = await indexOf({
      formamorphBackup: 1,
      data: {
        worlds: [{ id: 'w1', name: 'One', data: world }, { id: 'w2', name: 'Two', data: world }],
        entities: [{ id: 'e1', name: 'Mara', data: { images: [png, png] } }],
      },
    });
    const progress: number[] = [];
    const request: RestoreRequest = {
      index,
      plans: await analyzeBackup(index),
      overwrite: NO_OVERWRITE,
      modes: { worlds: 'optimize', entities: 'optimize' },
      webpSupported: true,
    };

    await restoreBackup(request, (done) => progress.push(done));

    const total = [...index.data.worlds, ...index.data.entities].reduce((n, e) => n + e.images, 0);
    expect(total).toBe(8);
    expect(progress.at(-1)).toBe(total);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    // The encoder can't run here, so it hands back each source; the records still land whole.
    const worlds = (await readAll('worldsDB', 'worlds')) as { id: string; thumbnail?: string }[];
    expect(worlds.map((r) => r.id)).toEqual(['w1', 'w2']);
    // The library card takes the optimized world's thumbnail.
    expect(worlds.map((r) => r.thumbnail)).toEqual([png, png]);
    expect(await readAll('entitiesDB', 'entities')).toEqual([{ id: 'e1', name: 'Mara', data: { images: [png, png] } }]);
  });
});
