// @vitest-environment jsdom
// Must load before importing the service: its singleton constructor opens IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorldStorageService from './WorldStorageService';
import { DEFAULT_WORLDS, clearDeletedDefaultWorlds } from '@/lib/defaultWorlds';
import valentinesRaw from '@/defaultworlds/valentines.json?raw';
import valentinesJson from '@/defaultworlds/valentines.json';
import { bundledWorldText } from '@/test/bundledWorldFiles';
import { readBundledWorld } from '@/lib/bundledWorldText';

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
    const { failed } = await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS, readBundledWorld);

    expect(failed).toEqual([]);
    expect(await storedIds()).toEqual([...ids].sort());
    // The stored file holds art; the seeder's copy holds only markers.
    expect(bundledWorldText('valentines')).toContain('data:image/');
    const valentines = JSON.stringify(await WorldStorageService.getWorldData('valentines'));
    expect(valentines).toContain('<stripped image/');
    expect(valentines).not.toContain('data:image/');
  });

  it("strips a test file's own `?raw` import of a bundled world too", () => {
    expect(valentinesRaw).toContain('<stripped image/');
    expect(valentinesRaw).not.toContain('data:image/');
  });

  it('strips a JSON import of a bundled world too', () => {
    const text = JSON.stringify(valentinesJson);
    expect(text).toContain('<stripped image/');
    expect(text).not.toContain('data:image/');
  });

  it('skips a bundled world the player deleted', async () => {
    await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS, readBundledWorld);
    await WorldStorageService.deleteWorld('drone');

    const { failed } = await WorldStorageService.loadDefaultWorlds(DEFAULT_WORLDS, readBundledWorld);

    expect(failed).toEqual([]);
    expect(await storedIds()).toEqual(ids.filter((id) => id !== 'drone').sort());
  });
});
