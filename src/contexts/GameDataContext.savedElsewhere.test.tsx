// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import WorldStorageService from '@/services/WorldStorageService';
import { WORLD_CHANGE_CHANNEL } from '@/lib/worldChangeSignal';
import type { World } from '@/types';

/**
 * The open world tracks writes another tab makes to it for as long as it is loaded, with no editor open, as
 * in play or on the Main Menu. Only an answer settles them: Keep Mine, a Reload, or a save that started after.
 */

const world = (id: string, name = 'Sedge Landing') => ({
  id, version: '3.0.0',
  worldOverview: {
    name, description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], traits: [], statUpdates: [], entities: [],
} as unknown as World);

type Handle = ReturnType<typeof useGameData>;
const Harness = ({ onReady }: { onReady: (ctx: Handle) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(world('w1'), false, { stored: true }); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return null;
};
const mount = async () => {
  let ctx!: Handle;
  render(<GameDataProvider><Harness onReady={(c) => { ctx = c; }} /></GameDataProvider>);
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return () => ctx;
};

let otherTab: BroadcastChannel;
const savedElsewhere = async (ctx: () => Handle, worldId = 'w1') => {
  otherTab.postMessage({ worldId });
  if (worldId === 'w1') await waitFor(() => expect(ctx().worldChangedElsewhere).toBe('saved'));
};
const deletedElsewhere = async (ctx: () => Handle) => {
  otherTab.postMessage({ worldId: 'w1', deleted: true });
  await waitFor(() => expect(ctx().worldChangedElsewhere).toBe('deleted'));
};
/** Lets a message already posted arrive and render. */
const settle = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 50); }));

beforeEach(() => {
  otherTab = new BroadcastChannel(WORLD_CHANGE_CHANNEL);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  otherTab.close();
  vi.restoreAllMocks();
});

describe('another tab writes the open world', () => {
  it('is heard with no editor open, and only for this world', async () => {
    const ctx = await mount();
    await savedElsewhere(ctx, 'another-world');
    await settle();
    expect(ctx().worldChangedElsewhere).toBeNull();
    await savedElsewhere(ctx);
  });

  it('is never this tab’s own save', async () => {
    const ctx = await mount();
    act(() => ctx().updateWorldOverview({ name: 'Brinewell' }));
    await act(async () => { await ctx().saveWorld(); });
    await settle();
    expect(ctx().worldChangedElsewhere).toBeNull();
  });
});

describe('a save', () => {
  it('answers the writes heard before it started, not one heard while it ran', async () => {
    const ctx = await mount();
    let finish!: () => void;
    const storeWorld = vi.spyOn(WorldStorageService, 'storeWorld')
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }))
      .mockResolvedValue(undefined);
    act(() => ctx().updateWorldOverview({ name: 'Brinewell' }));
    let saving!: Promise<unknown>;
    act(() => { saving = ctx().saveWorld(); });
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));

    await savedElsewhere(ctx);
    await act(async () => { finish(); await saving; });
    expect(ctx().worldChangedElsewhere).toBe('saved');

    await act(async () => { await ctx().saveWorld(); });
    expect(ctx().worldChangedElsewhere).toBeNull();
  });

  it('on its own answers nothing: only a save by hand is Keep Mine (Q35)', async () => {
    const ctx = await mount();
    await savedElsewhere(ctx);
    vi.spyOn(WorldStorageService, 'storeWorld').mockResolvedValue(undefined);
    act(() => ctx().updateWorldOverview({ name: 'Brinewell' }));
    await act(async () => { await ctx().saveWorld({ markSaved: false }); });
    expect(ctx().worldChangedElsewhere).toBe('saved');
  });

  it('that fails answers nothing', async () => {
    const ctx = await mount();
    await savedElsewhere(ctx);
    vi.spyOn(WorldStorageService, 'storeWorld').mockRejectedValue(new Error('disk gone'));
    await act(async () => { await ctx().saveWorld(); });
    expect(ctx().worldChangedElsewhere).toBe('saved');
  });
});

describe('the answers', () => {
  it('Keep Mine settles every write heard so far, and a later one is heard again', async () => {
    const ctx = await mount();
    await savedElsewhere(ctx);
    act(() => ctx().keepWorldCopy());
    expect(ctx().worldChangedElsewhere).toBeNull();
    await savedElsewhere(ctx);
  });

  it('Reload loads the stored copy and settles the writes heard before its read', async () => {
    const ctx = await mount();
    await savedElsewhere(ctx);
    let read!: (w: World) => void;
    vi.spyOn(WorldStorageService, 'getWorldData')
      .mockImplementationOnce(() => new Promise((resolve) => { read = resolve; }));
    let reloading!: Promise<boolean>;
    act(() => { reloading = ctx().reloadWorld(); });
    await waitFor(() => expect(read).toBeTypeOf('function'));

    // Written after the read began, so the copy being read may not hold it.
    await savedElsewhere(ctx);
    await act(async () => { read(world('w1', 'Saltmarsh')); await reloading; });
    expect(ctx().worldOverview.name).toBe('Saltmarsh');
    expect(ctx().isWorldDirty).toBe(false);
    expect(ctx().worldChangedElsewhere).toBe('saved');

    vi.spyOn(WorldStorageService, 'getWorldData').mockResolvedValueOnce(world('w1', 'Saltmarsh Quay'));
    await act(async () => { await ctx().reloadWorld(); });
    expect(ctx().worldOverview.name).toBe('Saltmarsh Quay');
    expect(ctx().worldChangedElsewhere).toBeNull();
  });

  it('Reload waits for a running save, so that save cannot land over the loaded copy', async () => {
    const ctx = await mount();
    let finish!: () => void;
    vi.spyOn(WorldStorageService, 'storeWorld')
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const getWorldData = vi.spyOn(WorldStorageService, 'getWorldData').mockResolvedValue(world('w1', 'Saltmarsh'));
    act(() => ctx().updateWorldOverview({ name: 'Brinewell' }));
    let saving!: Promise<unknown>;
    let reloading!: Promise<boolean>;
    act(() => { saving = ctx().saveWorld({ markSaved: false }); reloading = ctx().reloadWorld(); });
    await settle();
    expect(getWorldData).not.toHaveBeenCalled();

    await act(async () => { finish(); await saving; await reloading; });
    expect(ctx().worldOverview.name).toBe('Saltmarsh');
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('a rollback to this tab’s own baseline answers nothing; opening another world starts over', async () => {
    const ctx = await mount();
    await savedElsewhere(ctx);
    act(() => ctx().discardChanges());
    expect(ctx().worldChangedElsewhere).toBe('saved');
    act(() => { ctx().loadWorldData(world('w2'), false, { stored: true }); });
    expect(ctx().worldChangedElsewhere).toBeNull();
  });
});

describe('another tab deletes the open world', () => {
  it('is heard as a delete, and the latest change names the kind', async () => {
    const ctx = await mount();
    await savedElsewhere(ctx);
    await deletedElsewhere(ctx);
    // Saved back by the other tab: the record is there again.
    await savedElsewhere(ctx);
  });

  it('stays a delete when a save that was running as it landed ends', async () => {
    const ctx = await mount();
    let finish!: () => void;
    const storeWorld = vi.spyOn(WorldStorageService, 'storeWorld')
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    act(() => ctx().updateWorldOverview({ name: 'Brinewell' }));
    let saving!: Promise<unknown>;
    act(() => { saving = ctx().saveWorld({ markSaved: false }); });
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));

    await deletedElsewhere(ctx);
    await act(async () => { finish(); await saving; });
    expect(ctx().worldChangedElsewhere).toBe('deleted');
  });

  it('a save after it answers it, as Keep Mine saves the world back', async () => {
    const ctx = await mount();
    await deletedElsewhere(ctx);
    vi.spyOn(WorldStorageService, 'storeWorld').mockResolvedValue(undefined);
    await act(async () => { await ctx().saveWorld(); });
    expect(ctx().worldChangedElsewhere).toBeNull();
  });
});
