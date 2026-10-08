// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import WorldStorageService from '@/services/WorldStorageService';
import type { World } from '@/types';

/** Saves write one at a time, in the order asked, so an auto save in flight never lands over a newer one. */

const WORLD = {
  id: 'w-queue', version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], traits: [], statUpdates: [], entities: [],
} as unknown as World;

type Handle = ReturnType<typeof useGameData>;

const Harness = ({ onReady }: { onReady: (ctx: Handle) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(WORLD); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return null;
};

afterEach(() => { vi.restoreAllMocks(); });

describe('a discard right after a save', () => {
  it('rolls back to the world the save wrote, before React commits the save', async () => {
    let ctx!: Handle;
    render(<GameDataProvider><Harness onReady={(c) => { ctx = c; }} /></GameDataProvider>);
    await waitFor(() => expect(ctx.worldLoaded).toBe(true));
    vi.spyOn(WorldStorageService, 'storeWorld').mockResolvedValue(undefined);

    act(() => ctx.updateWorldOverview({ name: 'Brinewell' }));
    // Inside one act, nothing commits between the save's end and the discard, as in an Exit that waited on it.
    await act(async () => {
      await ctx.saveWorld({ markSaved: false });
      ctx.discardChanges();
    });
    expect(ctx.worldOverview.name).toBe('Brinewell');
    expect(ctx.isWorldDirty).toBe(false);
  });
});

describe('two saves asked for at once', () => {
  it('writes the second after the first, and ends clean on the newer world', async () => {
    let ctx!: Handle;
    render(<GameDataProvider><Harness onReady={(c) => { ctx = c; }} /></GameDataProvider>);
    await waitFor(() => expect(ctx.worldLoaded).toBe(true));

    let finishFirst!: () => void;
    const storeWorld = vi.spyOn(WorldStorageService, 'storeWorld')
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);

    act(() => ctx.updateWorldOverview({ name: 'Brinewell' }));
    let first!: Promise<unknown>;
    act(() => { first = ctx.saveWorld({ markSaved: false }); });
    await waitFor(() => expect(storeWorld).toHaveBeenCalledTimes(1));

    act(() => ctx.updateWorldOverview({ name: 'Brinewell Quay' }));
    let second!: Promise<unknown>;
    act(() => { second = ctx.saveWorld(); });
    await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0); }));
    expect(storeWorld).toHaveBeenCalledTimes(1);

    await act(async () => { finishFirst(); await Promise.all([first, second]); });
    expect(storeWorld).toHaveBeenCalledTimes(2);
    expect(storeWorld.mock.calls.map(([record]) => record.name)).toEqual(['Brinewell', 'Brinewell Quay']);
    expect(ctx.isWorldDirty).toBe(false);
  });
});
