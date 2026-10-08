// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import { useWorldHistory } from './worldRecorder';
import type { Entity, World } from '@/types';

/** A save that writes owned library copies back stamps the live copies. The stamps are not edits. */

const STAMP = { sourceRevision: 'rev-2' };

// The library holds nothing in this test, so the write-back is the one boundary stood in for: it reports one
// written copy, as a save of an owned, edited copy does.
const whileWriting = vi.hoisted(() => ({ edit: null as (() => void) | null }));
vi.mock('@/lib/libraryWriteBack', () => ({
  planOwnedWriteBack: async () => async () => {
    // An author's edit that reaches the world just before the stamps do, so both commit together.
    whileWriting.edit?.();
    return [{ id: 'wick', link: STAMP }];
  },
}));
beforeEach(() => { whileWriting.edit = null; });

// Only the slices the stamps touch, as hand-authored world JSON gives them; loadWorldData fills the rest.
const WORLD = {
  id: 'w-stamps', version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [], locations: [], traits: [], statUpdates: [],
  entities: [{ id: 'wick', name: 'Wick' }, { id: 'moss', name: 'Moss' }],
} as unknown as World;

type Handle = ReturnType<typeof useGameData>;
type HistoryView = ReturnType<typeof useWorldHistory>;

const Harness = ({ onReady }: { onReady: (ctx: Handle, history: HistoryView) => void }) => {
  const ctx = useGameData();
  const history = useWorldHistory();
  useEffect(() => { ctx.loadWorldData(WORLD); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx, history);
  return null;
};

const open = async () => {
  let ctx!: Handle;
  let history!: HistoryView;
  render(<GameDataProvider><Harness onReady={(c, h) => { ctx = c; history = h; }} /></GameDataProvider>);
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return { ctx: () => ctx, history: () => history };
};

const act1 = (writes: () => void) => act(async () => { writes(); });
const rename = (ctx: Handle, id: string, name: string) =>
  act1(() => ctx.updateEntity({ ...ctx.entities.find((e) => e.id === id)!, name } as Entity));
const save = (ctx: Handle) => act(async () => { expect((await ctx.saveWorld()).ok).toBe(true); });
const wick = (ctx: Handle) => ctx.entities.find((e) => e.id === 'wick')!;

describe('the history across a save that stamps', () => {
  it('records the stamps as no Step', async () => {
    const { ctx, history } = await open();
    await rename(ctx(), 'wick', 'Wick the Elder');
    await save(ctx());
    expect(wick(ctx()).link).toEqual(expect.objectContaining(STAMP));
    expect(history().steps).toHaveLength(1);
    expect(history().saved).toBe(1);
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('reads clean again when a redo returns to the stamped marker', async () => {
    const { ctx, history } = await open();
    await rename(ctx(), 'wick', 'Wick the Elder');
    await save(ctx());

    await act1(() => history().undo());
    expect(wick(ctx()).name).toBe('Wick');
    expect(ctx().isWorldDirty).toBe(true);

    await act1(() => history().redo());
    expect(wick(ctx()).name).toBe('Wick the Elder');
    expect(wick(ctx()).link).toEqual(expect.objectContaining(STAMP));
    expect(ctx().isWorldDirty).toBe(false);
  });

  it('still records an edit that commits together with the stamps', async () => {
    const { ctx, history } = await open();
    await rename(ctx(), 'wick', 'Wick the Elder');
    whileWriting.edit = () => ctx().updateEntity({ ...ctx().entities.find((e) => e.id === 'moss')!, name: 'Old Moss' } as Entity);
    await save(ctx());

    expect(history().steps).toHaveLength(2);
    await act1(() => history().undo());
    expect(ctx().entities.find((e) => e.id === 'moss')!.name).toBe('Moss');
    expect(wick(ctx()).name).toBe('Wick the Elder');
  });
});
