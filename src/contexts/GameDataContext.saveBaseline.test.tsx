// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import WorldStorageService from '@/services/WorldStorageService';
import type { Entity, World } from '@/types';

/** A save moves the dirty baseline, through the real provider and the real IndexedDB service. */

const WORLD = {
  id: 'w-baseline', version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], traits: [], statUpdates: [],
  entities: [
    { id: 'e1', name: 'Wick', image: 'data:image/webp;base64,AAAA' },
    { id: 'e2', name: 'Moss' },
  ],
} as unknown as World;

type Handle = ReturnType<typeof useGameData>;

const Harness = ({ onReady }: { onReady: (ctx: Handle) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(WORLD); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return null;
};

const open = async () => {
  let ctx!: Handle;
  render(<GameDataProvider><Harness onReady={(c) => { ctx = c; }} /></GameDataProvider>);
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return () => ctx;
};

const rename = (ctx: Handle, id: string, name: string) =>
  act(() => ctx.updateEntity({ ...ctx.entities.find((e) => e.id === id)!, name } as Entity));

describe('the dirty baseline across a save', () => {
  it('is clean after a save, and dirty again after the next edit', async () => {
    const ctx = await open();
    rename(ctx(), 'e2', 'Moss the Elder');
    expect(ctx().isWorldDirty).toBe(true);

    await act(async () => { expect((await ctx().saveWorld()).ok).toBe(true); });
    expect(ctx().isWorldDirty).toBe(false);

    rename(ctx(), 'e1', 'Wick the Younger');
    expect(ctx().isWorldDirty).toBe(true);
    // Back to the saved name, not the loaded one, is clean.
    rename(ctx(), 'e1', 'Wick');
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('discards back to the saved world exactly, not to the load', async () => {
    const ctx = await open();
    rename(ctx(), 'e2', 'Moss the Elder');
    await act(async () => { await ctx().saveWorld(); });
    const saved = ctx().getWorldData();

    rename(ctx(), 'e1', 'Wick the Younger');
    act(() => ctx().addEntity({ id: 'e3', name: 'Stray' } as Entity));
    act(() => ctx().discardChanges());

    expect(ctx().getWorldData()).toEqual(saved);
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('stores the world the baseline holds', async () => {
    const ctx = await open();
    rename(ctx(), 'e2', 'Moss the Elder');
    await act(async () => { await ctx().saveWorld(); });

    const stored = await WorldStorageService.getWorldData(WORLD.id) as World;
    expect(stored.entities.map((e) => e.name)).toEqual(['Wick', 'Moss the Elder']);
  });
});
