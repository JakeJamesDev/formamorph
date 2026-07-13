import { beforeEach, describe, it, expect, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import legacySave from './__fixtures__/legacy-save-1.2.1.json';

/**
 * The same-origin itch path: after updating the itch build to v2, the old build's `FORMAMORPH_DB`/`saves`
 * rows still sit in the browser. migrateLegacySaves (fired when Load Game opens) must copy them into the
 * id-keyed `saveRecords` store and clear the legacy store — the in-place counterpart to file import.
 */
let db: typeof import('../components/modals/dbUtils');
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('indexedDB', new IDBFactory());
  db = await import('../components/modals/dbUtils');
});

// Seed a row into the legacy `saves` store exactly as the old build wrote it (keyPath `name`).
async function seedLegacy(row: Record<string, unknown>) {
  const conn = await db.initDB();
  await new Promise<void>((resolve, reject) => {
    const req = conn.transaction([db.LEGACY_STORE], 'readwrite').objectStore(db.LEGACY_STORE).put(row);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function legacyCount() {
  const conn = await db.initDB();
  return new Promise<number>((resolve, reject) => {
    const req = conn.transaction([db.LEGACY_STORE], 'readonly').objectStore(db.LEGACY_STORE).getAll();
    req.onsuccess = () => resolve((req.result as unknown[]).length);
    req.onerror = () => reject(req.error);
  });
}

describe('migrateLegacySaves (same-origin in-place import)', () => {
  it('copies a real v1.2.1 saves row into the id-keyed store and clears the legacy store', async () => {
    await seedLegacy(legacySave as unknown as Record<string, unknown>);

    await db.migrateLegacySaves(() => undefined); // worldName is null in this save → no world match

    const records = await db.getAllSaveRecords();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Fix_Save_Flow');
    expect(typeof records[0].id).toBe('string'); // a stable id is minted
    expect(records[0].currentState).toBeTruthy(); // the save payload carried over intact
    expect(await legacyCount()).toBe(0); // legacy store cleared after a successful copy
  });

  it('stamps worldId when the save’s world name matches an installed world', async () => {
    await seedLegacy({ ...(legacySave as unknown as Record<string, unknown>), worldName: 'The White Room' });
    await db.migrateLegacySaves((name) => (name === 'The White Room' ? 'world-123' : undefined));
    const records = await db.getAllSaveRecords();
    expect(records[0].worldId).toBe('world-123');
  });

  it('is idempotent — a second run with an empty legacy store adds no duplicates', async () => {
    await seedLegacy(legacySave as unknown as Record<string, unknown>);
    await db.migrateLegacySaves(() => undefined);
    await db.migrateLegacySaves(() => undefined);
    expect(await db.getAllSaveRecords()).toHaveLength(1);
  });
});
