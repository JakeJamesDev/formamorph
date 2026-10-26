// @vitest-environment jsdom
// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorldStorageService from './WorldStorageService';
import { DEFAULT_WORLDS, clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import valentinesSource from '@/defaultworlds/valentines.json?raw';

const ids = DEFAULT_WORLDS.map((w) => w.id);
const storedIds = async () => (await WorldStorageService.getWorldMetadata()).map((m) => m.id).sort();

beforeEach(() => {
  localStorage.clear();
  clearDeletedDefaultWorlds();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
  await Promise.all(ids.map((id) => WorldStorageService.deleteWorld(id)));
  clearDeletedDefaultWorlds();
  vi.restoreAllMocks();
});

describe('loadDefaultWorlds (stripped seed)', () => {
  it('seeds every bundled world from its image-stripped copy', async () => {
    const { failed } = await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS);

    expect(failed).toEqual([]);
    expect(await storedIds()).toEqual([...ids].sort());
    // A test file's own `?raw` import keeps the art; the seeder's copy holds only markers.
    expect(valentinesSource).toContain('data:image/');
    const valentines = JSON.stringify(await WorldStorageService.getWorldData('valentines'));
    expect(valentines).toContain('<stripped image/');
    expect(valentines).not.toContain('data:image/');
  });

  it('skips a bundled world the player deleted', async () => {
    await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS);
    await WorldStorageService.deleteWorld('drone');

    const { failed } = await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS);

    expect(failed).toEqual([]);
    expect(await storedIds()).toEqual(ids.filter((id) => id !== 'drone').sort());
  });
});
