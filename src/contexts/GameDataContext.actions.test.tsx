// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData, useGameDataActions, type GameDataActions } from './GameDataContext';
import WorldStorageService from '@/services/WorldStorageService';
import type { Entity, World } from '@/types';

/** Components that only write keep still while the world changes, and their actions still act on the world as it stands. */

const WORLD = {
  id: 'w-actions', version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', tags: [],
  },
  stats: [], locations: [], traits: [], statUpdates: [],
  entityGroups: [
    { id: 'outer', name: 'Harbor' },
    { id: 'inner', name: 'Lamp-keepers', parentId: 'outer' },
  ],
  entities: [
    { id: 'e1', name: 'Wick', groupId: 'inner' },
    { id: 'e2', name: 'Moss' },
  ],
} as unknown as World;

type Handle = ReturnType<typeof useGameData>;

const Reader = ({ onReady }: { onReady: (ctx: Handle) => void }) => {
  const ctx = useGameData();
  useEffect(() => { ctx.loadWorldData(WORLD); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx);
  return null;
};

const Writer = ({ onRender }: { onRender: (actions: GameDataActions) => void }) => {
  onRender(useGameDataActions());
  return null;
};

const open = async () => {
  let ctx!: Handle;
  const renders: GameDataActions[] = [];
  render(
    <GameDataProvider>
      <Reader onReady={(c) => { ctx = c; }} />
      <Writer onRender={(a) => renders.push(a)} />
    </GameDataProvider>,
  );
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return { ctx: () => ctx, renders };
};

const rename = (ctx: Handle, id: string, name: string) =>
  act(() => ctx.updateEntity({ ...ctx.entities.find((e) => e.id === id)!, name } as Entity));

describe('the data context actions', () => {
  it('do not re-render a component that reads only them when an entity changes', async () => {
    const { ctx, renders } = await open();
    const before = renders.length;
    rename(ctx(), 'e2', 'Moss the Elder');
    rename(ctx(), 'e2', 'Moss the Eldest');
    expect(ctx().entities.find((e) => e.id === 'e2')?.name).toBe('Moss the Eldest');
    expect(renders.length).toBe(before);
  });

  it('remove a group by the groups as they stand, not as they stood at first render', async () => {
    const { ctx, renders } = await open();
    const actions = renders[0];
    act(() => actions.addEntityGroup({ id: 'late', name: 'Night watch', parentId: 'outer' }));
    act(() => actions.updateEntity({ ...ctx().entities.find((e) => e.id === 'e1')!, groupId: 'late' }));
    act(() => actions.removeEntityGroup('late'));
    expect(ctx().entityGroups.map((g) => g.id)).toEqual(['outer', 'inner']);
    expect(ctx().entities.find((e) => e.id === 'e1')?.groupId).toBe('outer');
  });

  it('delete an entity group into its own slot, so the siblings keep their order', async () => {
    const { ctx, renders } = await open();
    const actions = renders[0];
    act(() => actions.setEntityGroups([{ id: 'g', name: 'Crew', parentId: null, order: 1 }]));
    act(() => actions.setEntities([
      { id: 'a', name: 'A', groupId: null, order: 0 },
      { id: 'x', name: 'X', groupId: 'g', order: 0 },
      { id: 'y', name: 'Y', groupId: 'g', order: 1 },
      { id: 'b', name: 'B', groupId: null, order: 2 },
    ] as Entity[]));
    act(() => actions.removeEntityGroup('g'));
    const inOrder = [...ctx().entities].sort((p, q) => (p.order ?? 0) - (q.order ?? 0)).map((e) => [e.id, e.groupId, e.order]);
    expect(inOrder).toEqual([['a', null, 0], ['x', null, 1], ['y', null, 2], ['b', null, 3]]);
  });

  it('delete a trait group into its own slot, so the siblings keep their order', async () => {
    const { ctx, renders } = await open();
    const actions = renders[0];
    act(() => actions.setTraitGroups([{ id: 'tg', name: 'Gifts', parentId: null, order: 1 }]));
    act(() => actions.setTraits([
      { id: 'a', name: 'A', statChanges: [], groupId: null, order: 0 },
      { id: 'x', name: 'X', statChanges: [], groupId: 'tg', order: 0 },
      { id: 'b', name: 'B', statChanges: [], groupId: null, order: 2 },
    ]));
    act(() => actions.removeTraitGroup('tg'));
    const inOrder = [...ctx().traits].sort((p, q) => (p.order ?? 0) - (q.order ?? 0)).map((t) => [t.id, t.groupId, t.order]);
    expect(inOrder).toEqual([['a', null, 0], ['x', null, 1], ['b', null, 2]]);
    expect(ctx().traitGroups).toEqual([]);
  });

  it('save the world as it stands', async () => {
    const { ctx, renders } = await open();
    rename(ctx(), 'e2', 'Moss the Elder');
    await act(async () => { expect((await renders[0].saveWorld()).ok).toBe(true); });
    expect(ctx().isWorldDirty).toBe(false);
    const stored = await WorldStorageService.getWorldData('w-actions') as World;
    expect(stored.entities.find((e) => e.id === 'e2')?.name).toBe('Moss the Elder');
  });
});
