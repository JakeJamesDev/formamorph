// Must load before the services: their constructors open IndexedDB.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { GameDataProvider, useGameData } from './GameDataContext';
import { useWorldHistory } from './worldRecorder';
import { Slider } from '@/components/ui/slider';
import { stepLabel } from '@/lib/editorHistoryLabels';
import { defaultDescriptorBands } from '@/lib/statDescriptors';
import type {
  Dictionary, Entity, GameLocation, Placeholder, PlaceholderGroup, Stat, Trait, TraitGroup, TraitLink, World,
} from '@/types';

/** Each author action is one Step: a typed run, a drag, a stepper burst, an operation. */

// The fixtures give only the fields these tests read, as hand-authored world JSON does.
const stat = (id: string, name = id): Stat => ({ id, name, description: '', value: 50, min: 0, max: 100 } as unknown as Stat);
const entity = (id: string, extra: Partial<Entity> = {}): Entity => ({ id, name: id, ...extra });

// Paladin pins a Blueprints placeholder, so an entity linked to it holds a Copy of Class Garb.
const BLUEPRINTS: PlaceholderGroup = { id: 'bp', name: 'Blueprints', parentId: null, order: 0, system: 'blueprints' };
const TRAIT_BLUEPRINTS: TraitGroup = { id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const garb: Placeholder = { id: 'garb', name: 'Class Garb', groupId: 'bp', values: [{ id: 'tabard', text: 'a tabard' }] };
const paladin: Trait = {
  id: 'paladin', name: 'Paladin', statChanges: [], groupId: 'tbp',
  placeholderPins: [{ placeholderId: 'garb', value: 'a tabard', valueId: 'tabard' }],
};
const paladinLink: TraitLink = { id: 'l1', originalId: 'paladin', kind: 'trait', originalName: 'Paladin', groupId: null, order: 0 };
const lore: Dictionary = {
  id: 'lore', name: 'Lore', enabled: true,
  entries: [{ id: 'tide', name: 'Tide Tables', key: ['tide'], value: 'Low at dawn.' }],
};

// A world with only the slices these tests write; loadWorldData fills the rest.
const world = (over: Partial<World> = {}): World => ({
  id: 'w-intent', version: '3.0.0',
  worldOverview: {
    name: 'Sedge Landing', description: '', author: '', thumbnail: null, bgm: null,
    systemPrompt: '', use3DModel: true, tags: [],
  },
  stats: [stat('hunger', 'Hunger'), stat('thirst', 'Thirst')],
  locations: [{ id: 'harbor', name: 'Harbor Steps' } as GameLocation],
  entities: [entity('wick', { name: 'Wick' })],
  traits: [], statUpdates: [],
  ...over,
} as unknown as World);

type Handle = ReturnType<typeof useGameData>;
type HistoryView = ReturnType<typeof useWorldHistory>;

/** The world, its history, and one slider bound to Hunger's value, as a world-bound control would be. */
const Reader = ({ initial, onReady }: { initial: World; onReady: (ctx: Handle, history: HistoryView) => void }) => {
  const ctx = useGameData();
  const history = useWorldHistory();
  useEffect(() => { ctx.loadWorldData(initial); /* once */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  onReady(ctx, history);
  const hunger = ctx.stats.find((s) => s.id === 'hunger');
  return hunger ? (
    <Slider
      aria-label="Hunger" min={0} max={100} step={1} value={[hunger.value as number]}
      onValueChange={([value]) => ctx.updateStat({ ...hunger, value } as Stat)}
    />
  ) : null;
};

const open = async (initial = world()) => {
  let ctx!: Handle;
  let history!: HistoryView;
  render(<GameDataProvider><Reader initial={initial} onReady={(c, h) => { ctx = c; history = h; }} /></GameDataProvider>);
  await waitFor(() => expect(ctx.worldLoaded).toBe(true));
  return { ctx: () => ctx, history: () => history };
};

/** One author action: the writes run, then the event loop moves on as it does between two actions. */
const act1 = (writes: () => void) => act(async () => { writes(); });
const outsideAct = async (run: () => Promise<void>) => {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const actEnvironment = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    await run();
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  }
};
/** The author waits before the next action. */
const pause = (ms: number) => vi.setSystemTime(Date.now() + ms);

const hunger = (ctx: Handle) => ctx.stats.find((s) => s.id === 'hunger')!;
const labels = (history: HistoryView) => history.steps.map(stepLabel);

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterEach(() => { vi.useRealTimers(); });

describe('Steps that match intent', () => {
  it('records a typed run as one Step and a run after the pause as a second', async () => {
    const { ctx, history } = await open();
    for (const text of ['T', 'Th', 'The', 'The pang']) {
      await act1(() => ctx().updateStat({ ...hunger(ctx()), description: text }));
      pause(200);
    }
    expect(labels(history())).toEqual(['Edit Stat Hunger: Description']);

    pause(1200);
    await act1(() => ctx().updateStat({ ...hunger(ctx()), description: 'The pang.' }));
    expect(history().steps).toHaveLength(2);

    await act1(() => history().undo());
    expect(hunger(ctx()).description).toBe('The pang');
    await act1(() => history().undo());
    expect(hunger(ctx()).description).toBe('');
    expect(history().canUndo).toBe(false);
  });

  it('merges a run of writes that each change two fields, labeled without a field', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().updateStat({ ...hunger(ctx()), name: 'Appetite', description: 'a' }));
    pause(200);
    await act1(() => ctx().updateStat({ ...hunger(ctx()), name: 'Appetites', description: 'ab' }));
    expect(labels(history())).toEqual(['Edit Stat Appetites']);
  });

  it('keys a rename whose descriptors follow it to the stat alone', async () => {
    const descriptors = defaultDescriptorBands('Hunger').map((band, i) => ({ ...band, id: `d${i}` }));
    const { ctx, history } = await open(world({ stats: [{ ...stat('hunger', 'Hunger'), descriptors }] }));
    for (const name of ['Hungerr', 'Hungerrr']) {
      await act1(() => ctx().updateStat({ ...hunger(ctx()), name }));
      pause(200);
    }
    expect(hunger(ctx()).descriptors?.[0].description).toBe('Hungerrr is low');
    expect(labels(history())).toEqual(['Edit Stat Hungerrr']);
  });

  it('keeps typed runs in two fields as two Steps', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().updateStat({ ...hunger(ctx()), description: 'Pang' }));
    pause(100);
    await act1(() => ctx().updateStat({ ...hunger(ctx()), name: 'Appetite' }));
    expect(labels(history())).toEqual(['Edit Stat Hunger: Description', 'Edit Stat Appetite: Name']);
  });

  it('records three stepper clicks within the pause as one Step', async () => {
    const { ctx, history } = await open();
    for (const max of [101, 102, 103]) {
      await act1(() => ctx().updateStat({ ...hunger(ctx()), max }));
      pause(300);
    }
    expect(labels(history())).toEqual(['Edit Stat Hunger: Max']);
    await act1(() => history().undo());
    expect(hunger(ctx()).max).toBe(100);
  });

  it('records a slider drag that pauses while held as one Step back to the value before the press', async () => {
    const { ctx, history } = await open();
    const thumb = screen.getByRole('slider', { name: 'Hunger' });
    fireEvent.pointerDown(thumb);
    for (let i = 0; i < 2; i += 1) {
      await act1(() => { fireEvent.keyDown(thumb, { key: 'ArrowRight' }); });
      pause(1500);
    }
    // The last move has not committed when the pointer is released.
    await act1(() => {
      fireEvent.keyDown(thumb, { key: 'ArrowRight' });
      fireEvent.pointerUp(window);
    });
    expect(hunger(ctx()).value).toBe(53);
    expect(history().steps).toHaveLength(1);

    await act1(() => history().undo());
    expect(hunger(ctx()).value).toBe(50);
    expect(history().canUndo).toBe(false);
  });

  it('starts a new Step after the drag ends', async () => {
    const { ctx, history } = await open();
    const thumb = screen.getByRole('slider', { name: 'Hunger' });
    fireEvent.pointerDown(thumb);
    await act1(() => { fireEvent.keyDown(thumb, { key: 'ArrowRight' }); });
    await act1(() => { fireEvent.pointerUp(window); });
    await act1(() => ctx().updateStat({ ...hunger(ctx()), description: 'Pang' }));
    expect(history().steps).toHaveLength(2);
  });

  it('records an operation across several ticks as one labeled Step', async () => {
    const { ctx, history } = await open();
    const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
    // Outside act, as in the app: act would hold every commit until after the batch closed.
    await outsideAct(() => history().batch('Optimize Images', async () => {
      ctx().updateWorldOverview({ thumbnail: 'data:image/webp;base64,AA' });
      await nextTask();
      ctx().setEntities((prev) => prev.map((e) => ({ ...e, images: ['data:image/webp;base64,BB'] })));
      await nextTask();
      ctx().setLocations((prev) => prev.map((l) => ({ ...l, backgroundImage: 'data:image/webp;base64,CC' })));
    }));
    expect(ctx().locations[0].backgroundImage).toBe('data:image/webp;base64,CC');
    expect(labels(history())).toEqual(['Optimize Images']);

    await act1(() => history().undo());
    expect(ctx().worldOverview.thumbnail).toBeNull();
    expect(ctx().entities[0].images).toBeUndefined();
    expect(ctx().locations[0].backgroundImage).toBeUndefined();
  });

  it('settles an open batch when the provider unmounts before the batch ends', async () => {
    let ctx!: Handle;
    let history!: HistoryView;
    const { unmount } = render(<GameDataProvider><Reader initial={world()} onReady={(c, h) => { ctx = c; history = h; }} /></GameDataProvider>);
    await waitFor(() => expect(ctx.worldLoaded).toBe(true));
    let finish!: () => void;
    const running = new Promise<void>((resolve) => { finish = resolve; });
    let cleanedUp = false;
    const operation = (async () => {
      try {
        await history.batch('Optimize Images', async () => {
          ctx.updateWorldOverview({ thumbnail: 'data:image/webp;base64,AA' });
          await running;
        });
      } finally {
        cleanedUp = true;
      }
    })();
    unmount();
    finish();
    await outsideAct(() => operation);
    expect(cleanedUp).toBe(true);
  });

  it('settles a batch whose end is queued when the provider unmounts', async () => {
    let ctx!: Handle;
    let history!: HistoryView;
    const { unmount } = render(<GameDataProvider><Reader initial={world()} onReady={(c, h) => { ctx = c; history = h; }} /></GameDataProvider>);
    await waitFor(() => expect(ctx.worldLoaded).toBe(true));
    let cleanedUp = false;
    await outsideAct(async () => {
      const operation = (async () => {
        try {
          await history.batch('Optimize Images', () => { ctx.updateWorldOverview({ thumbnail: 'data:image/webp;base64,AA' }); });
        } finally {
          cleanedUp = true;
        }
      })();
      // The run has returned and the end waits for its commit, which the unmount cuts off.
      await Promise.resolve();
      await Promise.resolve();
      unmount();
      await operation;
    });
    expect(cleanedUp).toBe(true);
  });

  it('ends a drag when its slider unmounts mid-drag, so a later write is a Step of its own', async () => {
    const { ctx, history } = await open();
    const thumb = screen.getByRole('slider', { name: 'Hunger' });
    fireEvent.pointerDown(thumb);
    await act1(() => { fireEvent.keyDown(thumb, { key: 'ArrowRight' }); });
    // The stat goes, so its slider unmounts before the pointer is released.
    await act1(() => ctx().removeStat('hunger'));
    pause(1500);
    await act1(() => ctx().updateStat({ ...ctx().stats[0], description: 'Dry' }));
    expect(history().steps).toHaveLength(2);
  });

  it('labels a Copy edit inside an entity as the placeholder', async () => {
    const { ctx, history } = await open(world({
      traits: [paladin], traitGroups: [TRAIT_BLUEPRINTS],
      placeholders: [garb], placeholderGroups: [BLUEPRINTS],
      entities: [entity('wick', { name: 'Wick', traitLinks: [paladinLink] })],
    }));
    const copy = (ctx().entities[0].placeholders ?? []).find((p) => p.blueprintId === 'garb')!;
    await act1(() => ctx().updatePlaceholder({ ...copy, values: [{ id: 'cloak', text: 'a cloak' }] }));
    expect(labels(history())).toEqual(['Edit Placeholder Class Garb: Values']);
  });

  it('labels a dictionary entry edit as the entry', async () => {
    const { ctx, history } = await open(world({ dictionaries: [lore] }));
    const entry = ctx().dictionaries[0].entries[0];
    await act1(() => ctx().updateDictionaryEntry({ ...entry, value: 'Low at dusk.' }));
    expect(labels(history())).toEqual(['Edit Entry Tide Tables: Value']);
  });

  it('labels a world setting by its field', async () => {
    const { ctx, history } = await open();
    await act1(() => ctx().updateWorldOverview({ use3DModel: false }));
    expect(labels(history())).toEqual(['Edit World: 3D Player Avatar']);
  });

  it('labels an entity edit through its function by the one field it changed, and runs the function once', async () => {
    const { ctx, history } = await open();
    const edit = vi.fn((e: Entity) => ({ ...e, aiDescription: 'A lamplighter.' }));
    await act1(() => ctx().editEntity('wick', edit));
    expect(edit).toHaveBeenCalledTimes(1);
    expect(labels(history())).toEqual(['Edit Entity Wick: AI Description']);
  });

  it("records a typed run in a linked entity as one Step, the first write's mark included", async () => {
    const { ctx, history } = await open(world({ entities: [entity('wick', { name: 'Wick', link: { sourceId: 'src' } })] }));
    for (const text of ['A', 'A lamp']) {
      await act1(() => ctx().updateEntity({ ...ctx().entities[0], playerDescription: text }));
      pause(200);
    }
    expect(ctx().entities[0].link?.localReplacement).toBe(true);
    expect(labels(history())).toEqual(['Edit Entity Wick: Player Description']);
  });
});
