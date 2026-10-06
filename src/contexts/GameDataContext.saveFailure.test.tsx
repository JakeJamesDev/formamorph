// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData, type SaveResult } from './GameDataContext';
import WorldStorageService from '@/services/WorldStorageService';
import DictionaryStorageService from '@/services/DictionaryStorageService';
import { WORLD_STORE } from '@/lib/worldLibrary';
import { failWritesOnQuota } from '@/test/quotaAbort';
import type { Dictionary, World } from '@/types';

/**
 * A world save on a full disk, through the real provider and the real IndexedDB services: the save answers
 * with the browser's error, and neither the stored world nor the owned library item it holds a copy of moves.
 */

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

const REVISION = '2026-01-01T00:00:00.000Z';
const BOOK: Dictionary = { id: 'lib-a', name: 'Fen Lore', entries: [{ id: 'k1', name: 'Fen', key: ['fen'], value: 'Wetland.' }] };

const WORLD = {
  id: 'w-save', version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
  dictionaries: [{
    id: 'b1', name: 'Fen Lore', entries: [{ id: 'own-1', name: 'Fen', key: ['fen'], value: 'Wetland.' }],
    link: { libraryId: 'lib-a', sourceName: 'Fen Lore', sourceRevision: REVISION },
  }],
} as unknown as World;

type Handle = ReturnType<typeof useGameData>;

const Harness = ({ onReady }: { onReady: (ctx: Handle) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(WORLD); ctx.setOwnedLibraryIds(['lib-a']); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return null;
};

/** Store the world and its owned library book, open the world, and rename the book's copy. */
const openAndEdit = async () => {
  await DictionaryStorageService.storeDictionary({ id: 'lib-a', name: 'Fen Lore', data: BOOK, createdAt: REVISION });
  const { worldOverview, ...data } = WORLD;
  await WorldStorageService.storeWorld({ id: WORLD.id, name: worldOverview.name, data: { worldOverview, ...data } } as never);
  let ctx!: Handle;
  render(<GameDataProvider><Harness onReady={(c) => { ctx = c; }} /></GameDataProvider>);
  await waitFor(() => expect(ctx.dictionaries[0]?.name).toBe('Fen Lore'));
  act(() => ctx.updateDictionary({ ...ctx.dictionaries[0], name: 'Fen Lore, revised' }));
  await waitFor(() => expect(ctx.isWorldDirty).toBe(true));
  expect(ctx.dictionaries[0].link?.localReplacement).toBeUndefined();
  return () => ctx;
};

let restore: (() => void) | null = null;
afterEach(() => { restore?.(); restore = null; });

describe('a world save on a full disk', () => {
  it('answers with the QuotaExceededError and the unsaved world, and stays dirty', async () => {
    const ctx = await openAndEdit();
    restore = failWritesOnQuota(WORLD_STORE);

    let result!: SaveResult;
    await act(async () => { result = await ctx().saveWorld(); });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ name: 'QuotaExceededError' });
    expect(result.world.dictionaries?.[0].name).toBe('Fen Lore, revised');
    expect(ctx().isWorldDirty).toBe(true);
  });

  it('leaves the stored world and its owned library item unchanged', async () => {
    const ctx = await openAndEdit();
    restore = failWritesOnQuota(WORLD_STORE);

    await act(async () => { await ctx().saveWorld(); });
    restore();
    restore = null;

    const stored = await WorldStorageService.getWorldData(WORLD.id) as World;
    expect(stored.dictionaries?.[0].name).toBe('Fen Lore');
    expect(stored.dictionaries?.[0].link?.sourceRevision).toBe(REVISION);
    expect(await DictionaryStorageService.getDictionaryData('lib-a')).toMatchObject({ name: 'Fen Lore' });
    const [item] = (await DictionaryStorageService.getDictionaryMetadata()).filter((m) => m.id === 'lib-a');
    expect(item.editedAt).toBeUndefined();
  });

  it('writes the library item after the world stores, once there is space', async () => {
    const ctx = await openAndEdit();

    let result!: SaveResult;
    await act(async () => { result = await ctx().saveWorld(); });

    expect(result.ok).toBe(true);
    expect(await DictionaryStorageService.getDictionaryData('lib-a')).toMatchObject({ name: 'Fen Lore, revised' });
    const stored = await WorldStorageService.getWorldData(WORLD.id) as World;
    const [item] = (await DictionaryStorageService.getDictionaryMetadata()).filter((m) => m.id === 'lib-a');
    expect(stored.dictionaries?.[0].link?.sourceRevision).toBe(item.editedAt);
  });
});
