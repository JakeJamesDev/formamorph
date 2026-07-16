// Must load before importing anything that opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseBackup, splitByConflict, BACKUP_CATEGORIES, itemLabel,
  buildBackup, listBackupItems, analyzeBackup, applyBackup, type CategoryPlan,
} from '@/lib/backup';
import { openDatabase, promisifyRequest } from '@/lib/idb';

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

describe('parseBackup', () => {
  it('rejects non-JSON', () => {
    expect(() => parseBackup('{ not json')).toThrow(/valid JSON/);
  });

  it('rejects JSON that is not a Formamorph backup', () => {
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow(/not a Formamorph backup/);
  });

  it('normalizes missing categories to empty arrays and drops id-less records', () => {
    const bundle = parseBackup(
      JSON.stringify({
        formamorphBackup: 1,
        data: { worlds: [{ id: 'w1' }, { name: 'no id' }] },
      }),
    );
    expect(bundle.data.worlds.map((r) => r.id)).toEqual(['w1']);
    for (const cat of BACKUP_CATEGORIES) expect(Array.isArray(bundle.data[cat])).toBe(true);
    expect(bundle.data.saves).toEqual([]);
  });

  it('keeps reading a bundle written by a newer app version', () => {
    // Readers warn on a newer format but still try — a backup must not become unreadable.
    const bundle = parseBackup(JSON.stringify({ formamorphBackup: 99, data: { worlds: [{ id: 'w1' }] } }));
    expect(bundle.formamorphBackup).toBe(99);
    expect(bundle.data.worlds).toHaveLength(1);
  });

  it('defaults a bundle missing its metadata rather than throwing', () => {
    const bundle = parseBackup(JSON.stringify({ formamorphBackup: 1, data: {} }));
    expect(bundle.appVersion).toBe('unknown');
    expect(bundle.exportedAt).toBe('');
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

/** Seed a store directly, bypassing the module under test. */
async function seed(dbName: string, store: string, records: { id: string; name?: string }[]) {
  const db = await openDatabase(dbName, 1, [{ name: store, keyPath: 'id' }]);
  const tx = db.transaction([store], 'readwrite').objectStore(store);
  await Promise.all(records.map((r) => promisifyRequest(tx.put(r))));
  db.close();
}

async function readAll(dbName: string, store: string): Promise<{ id: string; name?: string }[]> {
  const db = await openDatabase(dbName, 1, [{ name: store, keyPath: 'id' }]);
  const out = await promisifyRequest<{ id: string; name?: string }[]>(
    db.transaction([store], 'readonly').objectStore(store).getAll(),
  );
  db.close();
  return out;
}

/**
 * Empty a store rather than delete its database: `dbUtils` never closes the connections it opens, and a
 * leaked handle blocks `deleteDatabase` indefinitely.
 */
async function wipe(dbName: string, store: string) {
  const db = await openDatabase(dbName, 1, [{ name: store, keyPath: 'id' }]);
  await promisifyRequest(db.transaction([store], 'readwrite').objectStore(store).clear());
  db.close();
}

const STORES: [string, string][] = [
  ['worldsDB', 'worlds'],
  ['entitiesDB', 'entities'],
  ['dictionariesDB', 'dictionaries'],
];

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

    const plans = await analyzeBackup(bundle);
    const result = await applyBackup(plans, {
      worlds: false, saves: false, entities: false, dictionaries: false,
    });

    expect(result.worlds).toEqual({ added: 1, overwritten: 0, skipped: 0 });
    expect(await readAll('worldsDB', 'worlds')).toEqual([{ id: 'w1', name: 'Sedge Landing' }]);
    expect(await readAll('dictionariesDB', 'dictionaries')).toEqual([{ id: 'd1', name: 'Lore' }]);
  });

  it('splits fresh from conflicting ids against what is already stored', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Mine' }]);
    const bundle = parseBackup(JSON.stringify({
      formamorphBackup: 1,
      data: { worlds: [{ id: 'w1', name: 'Theirs' }, { id: 'w2', name: 'New' }] },
    }));

    const worlds = (await analyzeBackup(bundle)).find((p) => p.category === 'worlds')!;
    expect(worlds.fresh.map((r) => r.id)).toEqual(['w2']);
    expect(worlds.conflicts.map((r) => r.id)).toEqual(['w1']);
  });

  it('keeps the stored copy when a conflicting category is not set to overwrite', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Mine' }]);
    const plans: CategoryPlan[] = [
      { category: 'worlds', fresh: [{ id: 'w2', name: 'New' }], conflicts: [{ id: 'w1', name: 'Theirs' }] },
    ];

    const result = await applyBackup(plans, {
      worlds: false, saves: false, entities: false, dictionaries: false,
    });

    expect(result.worlds).toEqual({ added: 1, overwritten: 0, skipped: 1 });
    const stored = await readAll('worldsDB', 'worlds');
    expect(stored.find((r) => r.id === 'w1')?.name).toBe('Mine'); // not clobbered
    expect(stored.find((r) => r.id === 'w2')?.name).toBe('New'); // fresh still lands
  });

  it('replaces the stored copy when the category is set to overwrite', async () => {
    await seed('worldsDB', 'worlds', [{ id: 'w1', name: 'Mine' }]);
    const plans: CategoryPlan[] = [
      { category: 'worlds', fresh: [], conflicts: [{ id: 'w1', name: 'Theirs' }] },
    ];

    const result = await applyBackup(plans, {
      worlds: true, saves: false, entities: false, dictionaries: false,
    });

    expect(result.worlds).toEqual({ added: 0, overwritten: 1, skipped: 0 });
    expect((await readAll('worldsDB', 'worlds')).find((r) => r.id === 'w1')?.name).toBe('Theirs');
  });
});
