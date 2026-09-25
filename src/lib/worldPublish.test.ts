// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WorldStorageService from '@/services/WorldStorageService';
import type { World } from '@/types';
import { clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import { buildWorldPublish, BUNDLED_WORLD_REFUSAL } from './worldPublish';

// The real bundled world, seeded through the real loader — the smallest one keeps the parse cheap.
const SEED = [{ id: 'rampage', defaultName: 'Rampage' }];

/** The library record the main menu holds for a selected world: its metadata row plus its data. */
async function libraryRecord(id: string) {
  const row = (await WorldStorageService.getWorldMetadata()).find((w) => w.id === id);
  if (!row) throw new Error(`No library row for ${id}`);
  return { ...row, data: (await WorldStorageService.getWorldData(id)) as World };
}

beforeEach(() => {
  localStorage.clear();
  clearDeletedDefaultWorlds();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
  await WorldStorageService.deleteWorld('rampage').catch(() => {});
  vi.restoreAllMocks();
});

describe('buildWorldPublish', () => {
  it('refuses a bundled world the player never edited', async () => {
    await WorldStorageService.loadDefaultWorlds(SEED);

    const attempt = buildWorldPublish(await libraryRecord('rampage'));

    expect(attempt).toEqual({ allowed: false, message: BUNDLED_WORLD_REFUSAL });
    expect(BUNDLED_WORLD_REFUSAL).toBe('This is a bundled world. Edit it to make it your own, then publish.');
  });

  it('allows the same bundled world after one editor save', async () => {
    await WorldStorageService.loadDefaultWorlds(SEED);
    const seeded = await libraryRecord('rampage');
    // What the editor's save writes: the same content, flagged as edited.
    await WorldStorageService.storeWorld({ ...seeded, dirty: true, editedAt: new Date().toISOString() });

    const attempt = buildWorldPublish(await libraryRecord('rampage'));

    expect(attempt.allowed).toBe(true);
    expect(attempt.allowed && attempt.payload).toMatchObject({ kind: 'world', name: seeded.data.worldOverview.name });
  });

  it('allows a world the player wrote, edited or not', async () => {
    await WorldStorageService.loadDefaultWorlds(SEED);
    const bundled = await libraryRecord('rampage');
    const id = crypto.randomUUID();
    // A duplicate carries bundled content under a new id; the client passes it and the server judges it.
    await WorldStorageService.storeWorld({ ...bundled, id, name: 'Mine', data: bundled.data });

    try {
      const record = await libraryRecord(id);
      expect(record.dirty).toBe(false);

      const attempt = buildWorldPublish(record);

      expect(attempt.allowed).toBe(true);
    } finally {
      await WorldStorageService.deleteWorld(id);
    }
  });
});
