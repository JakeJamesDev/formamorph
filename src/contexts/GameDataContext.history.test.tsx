// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { GameDataProvider, useGameData } from './GameDataContext';
import { useWorldHistory } from './worldRecorder';
import type { Entity, GameLocation, Placeholder, PlaceholderGroup, Stat, Trait, TraitGroup, TraitLink, World } from '@/types';

/** Every write to the open world can be undone and redone through the provider's history. */

// The fixtures give only the fields these tests read, as hand-authored world JSON does.
const stat = (id: string, name = id): Stat => ({ id, name, value: 50, min: 0, max: 100 } as unknown as Stat);
const location = (id: string, name = id): GameLocation => ({ id, name } as GameLocation);
const entity = (id: string, extra: Partial<Entity> = {}): Entity => ({ id, name: id, ...extra });

// Paladin pins a Blueprints placeholder, so an entity linked to it holds a copy the follow pass drops with the link.
const BLUEPRINTS: PlaceholderGroup = { id: 'bp', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' };
const TRAIT_BLUEPRINTS: TraitGroup = { id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const garb: Placeholder = { id: 'garb', name: 'Class Garb', groupId: 'bp', values: [{ id: 'tabard', text: 'a tabard' }] };
const paladin: Trait = {
  id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'tbp',
  placeholderPins: [{ placeholderId: 'garb', value: 'a tabard', valueId: 'tabard' }],
};
const paladinLink: TraitLink = { id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 0 };

// A world with only the slices these tests write; loadWorldData fills the rest.
const world = (id: string, over: Partial<World> = {}): World => ({
  id, version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [stat('hunger'), stat('thirst'), stat('warmth')],
  locations: [location('harbor', 'Harbor Steps')],
  entities: [entity('wick', { name: 'Wick' })],
  traits: [], statUpdates: [],
  ...over,
} as unknown as World);

type Handle = ReturnType<typeof useGameData>;
type HistoryView = ReturnType<typeof useWorldHistory>;

const Reader = ({ initial, onReady }: { initial: World; onReady: (ctx: Handle, history: HistoryView) => void }) => {
  const ctx = useGameData();
  const history = useWorldHistory();
  useEffect(() => { ctx.loadWorldData(initial); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx, history);
  return <button type="button" onClick={() => ctx.removeTrait('paladin')}>Remove Paladin</button>;
};

const open = async (initial = world('w-history')) => {
  let ctx!: Handle;
  let history!: HistoryView;
  render(<GameDataProvider><Reader initial={initial} onReady={(c, h) => { ctx = c; history = h; }} /></GameDataProvider>);
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return { ctx: () => ctx, history: () => history };
};

/** One author action: the writes run together, then the event loop moves on as it does between two actions. */
const act1 = (writes: () => void) => act(async () => { writes(); });

const statIds = (ctx: Handle) => ctx.stats.map((s) => s.id);

describe('the world history', () => {
  it('undoes a removed stat back to its index and redoes the removal', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().removeStat('thirst'));
    expect(statIds(ctx())).toEqual(['hunger', 'warmth']);

    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);

    await act1(() => history().redo());
    expect(statIds(ctx())).toEqual(['hunger', 'warmth']);
  });

  it('undoes an added and an edited location, newest first', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().addLocation(location('docks', 'Docks')));
    await act1(() => ctx().updateLocation({ ...ctx().locations.find((l) => l.id === 'harbor')!, name: 'Low Harbor' }));

    await act1(() => history().undo());
    expect(ctx().locations.map((l) => l.name)).toEqual(['Harbor Steps', 'Docks']);
    await act1(() => history().undo());
    expect(ctx().locations.map((l) => l.id)).toEqual(['harbor']);
    expect(history().canUndo).toBe(false);

    await act1(() => history().redo());
    await act1(() => history().redo());
    expect(ctx().locations.map((l) => l.name)).toEqual(['Low Harbor', 'Docks']);
  });

  it('undoes an added and an edited entity', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().addEntity(entity('moss', { name: 'Moss' })));
    await act1(() => ctx().updateEntity({ ...ctx().entities.find((e) => e.id === 'wick')!, name: 'Old Wick' }));

    await act1(() => history().undo());
    expect(ctx().entities.map((e) => e.name)).toEqual(['Wick', 'Moss']);
    await act1(() => history().undo());
    expect(ctx().entities.map((e) => e.name)).toEqual(['Wick']);
    await act1(() => history().redo());
    expect(ctx().entities.map((e) => e.name)).toEqual(['Wick', 'Moss']);
  });

  it('records a write that bypasses the actions', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().setStats((prev) => [...prev].reverse()));
    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);
  });

  it('records two setter calls in one handler as one Step', async () => {
    const { ctx, history } = await open();
    await act1(() => {
      ctx().removeStat('hunger');
      ctx().addLocation(location('docks', 'Docks'));
    });
    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);
    expect(ctx().locations.map((l) => l.id)).toEqual(['harbor']);
    expect(history().canUndo).toBe(false);
  });

  it('folds two commits in one tick into one Step', async () => {
    const { ctx, history } = await open();
    await act1(() => {
      flushSync(() => ctx().removeStat('hunger'));
      ctx().removeStat('warmth');
    });
    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);
    expect(history().canUndo).toBe(false);
  });

  it('keeps two separate actions as two Steps', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().removeStat('hunger'));
    await act1(() => ctx().removeStat('warmth'));
    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['thirst', 'warmth']);
    expect(history().canUndo).toBe(true);
  });

  it('folds the copies pass after a trait removal into the removal', async () => {
    const { ctx, history } = await open(world('w-links', {
      traits: [paladin], traitGroups: [TRAIT_BLUEPRINTS],
      placeholders: [garb], placeholderGroups: [BLUEPRINTS],
      entities: [entity('wick', { name: 'Wick', traitLinks: [paladinLink] })],
    }));
    const copiesOf = () => (ctx().entities[0].placeholders ?? []).filter((p) => p.blueprintId).map((p) => p.id);
    const copy = copiesOf();
    expect(copy).toHaveLength(1);

    // A native click outside act, as in the app: the removal commits at once and the copies pass in a later task.
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const actEnvironment = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      screen.getByRole('button', { name: 'Remove Paladin' }).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await waitFor(() => expect(copiesOf()).toEqual([]));
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    }
    expect(ctx().entities[0].traitLinks ?? []).toEqual([]);

    await act1(() => history().undo());
    expect(ctx().traits.map((t) => t.id)).toEqual(['paladin']);
    expect(ctx().entities[0].traitLinks).toEqual([paladinLink]);
    expect(copiesOf()).toEqual(copy);
    expect(history().canUndo).toBe(false);
  });

  it('never records an undo or a redo as a Step', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().removeStat('hunger'));
    await act1(() => ctx().removeStat('thirst'));
    await act1(() => history().undo());
    await act1(() => history().undo());
    expect(history().canUndo).toBe(false);
    expect(history().canRedo).toBe(true);

    await act1(() => history().redo());
    expect(history().canRedo).toBe(true);
    await act1(() => history().redo());
    expect(statIds(ctx())).toEqual(['warmth']);
    expect(history().canRedo).toBe(false);
  });

  it('composes two undos made before the world commits', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().removeStat('hunger'));
    await act1(() => ctx().removeStat('thirst'));
    await act1(() => { history().undo(); history().undo(); });
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);
  });

  it('records a write that commits together with an undo', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().removeStat('hunger'));
    await act1(() => {
      history().undo();
      ctx().removeStat('warmth');
    });
    expect(statIds(ctx())).toEqual(['hunger', 'thirst']);
    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);
  });

  it('drops the undone future on a new edit', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().removeStat('hunger'));
    await act1(() => history().undo());
    await act1(() => ctx().removeStat('warmth'));
    expect(history().canRedo).toBe(false);
    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);
  });

  it('starts an empty stack when another world opens', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().removeStat('hunger'));
    expect(history().canUndo).toBe(true);

    await act1(() => { ctx().loadWorldData(world('w-other')); });
    expect(history().canUndo).toBe(false);
    expect(history().canRedo).toBe(false);
    await act1(() => history().undo());
    expect(statIds(ctx())).toEqual(['hunger', 'thirst', 'warmth']);
  });
});
