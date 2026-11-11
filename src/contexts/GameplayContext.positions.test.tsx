// Entity positions and the position engine's state across a save/load round trip. Storage is real (in-memory) —
// the provider writes to IndexedDB. Must be imported before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { GameDataProvider } from './GameDataContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';
import { getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import { castRoutines } from '@/lib/entityKind';
import { dropLocationFromEntities } from '@/lib/entityPresence';
import { storyMinute } from '@/lib/gameClock';
import { placeAll, positionWorld } from '@/lib/positionPlay';
import { PLAYER_START, type ChatMessage, type Entity, type GameLocation, type UniqueStates, type SaveRecord } from '@/types';

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));

type Gameplay = ReturnType<typeof useGameplay>;

const Expose = ({ expose }: { expose: (g: Gameplay) => void }) => {
  expose(useGameplay());
  return null;
};

const mount = () => {
  let gameplay: Gameplay | null = null;
  render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <GameplayProvider>
          <Expose expose={(g) => { gameplay = g; }} />
        </GameplayProvider>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return () => {
    if (!gameplay) throw new Error('gameplay context not available (did the render throw?)');
    return gameplay as Gameplay;
  };
};

const place = (id: string): GameLocation => ({ id, name: id });
const keep = place('keep');
const tower = place('tower');
const LOCATIONS = [keep, tower];
/** The story minute a fresh save stands at: no time passed, the default opening hour. */
const OPENING = storyMinute(0);
// Two Starts, one at each place, and no schedule.
const merchant: Entity = {
  id: 'merchant', name: 'Merchant', kind: 'unique', locations: ['keep', 'tower'],
  starts: [{ id: 'at-keep', place: 'keep', weight: 1, schedule: [] }, { id: 'at-tower', place: 'tower', weight: 1, schedule: [] }],
};
const guard: Entity = {
  id: 'guard', name: 'Guard', kind: 'unique', locations: ['keep'], traversable: 'anywhere',
  starts: [{ id: 'post', place: 'keep', weight: 1, schedule: [] }],
};
// Walks the keep and the tower, an hour at each.
const watch: Entity = {
  id: 'watch', name: 'Watch', kind: 'unique', locations: ['keep', 'tower'],
  starts: [{ id: 'round', place: 'keep', weight: 1, schedule: [{
    id: 'walk', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'keep', idle: 60 }, { place: 'tower', idle: 60 }] },
  }] }],
};
const WORLD = [merchant, guard, watch];

const save = async (live: () => Gameplay, id: string) => {
  await act(async () => { await live().saveGame('slot', 'World', 'w1', id); });
};
const load = async (live: () => Gameplay, id: string, entities: Entity[] = WORLD, locations = LOCATIONS) => {
  await act(async () => { await live().loadGame(id, locations, [], entities, undefined, undefined, undefined, []); });
};

describe('entity positions in the save', () => {
  it('rolls one Start per Unique entity for a new game, saves it, and keeps it on load', async () => {
    const live = mount();
    // A draw at the top of the range takes each entity's last Start.
    const book = placeAll({ positions: {}, uniques: {}, generics: {} }, positionWorld(castRoutines(WORLD), OPENING, 'keep', LOCATIONS, [], () => 0.99));
    expect(book.uniques.merchant.startId).toBe('at-tower');
    await act(async () => {
      live().setEntityPositions(book.positions);
      live().setUniqueStates(book.uniques);
    });
    await save(live, 'save-roll');
    await act(async () => { live().setEntityPositions({}); live().setUniqueStates({}); });
    await load(live, 'save-roll');
    expect(live().uniqueStates.merchant.startId).toBe('at-tower');
    expect(live().entityPositions).toMatchObject({ merchant: 'tower', guard: 'keep', watch: 'keep' });
  });

  it('round-trips the chosen Start, follow state, wait until-time, hold, idle end and patrol stop', async () => {
    const live = mount();
    const states: UniqueStates = {
      merchant: { startId: 'at-tower', lastRun: OPENING, follow: { mode: 'waiting', until: OPENING + 120, script: true } },
      guard: { startId: 'post', lastRun: OPENING, follow: { mode: 'following' } },
      watch: { startId: 'round', rowId: 'walk', lastRun: OPENING, hold: { until: OPENING + 90 }, idleEnd: OPENING + 90, stop: 1 },
    };
    await act(async () => {
      live().setEntityPositions({ merchant: 'tower', guard: 'keep', watch: 'keep' });
      live().setUniqueStates(states);
    });
    expect(live().saveCurrentGameState().uniqueStates).toEqual(states);
    await save(live, 'save-states');
    await act(async () => { live().setUniqueStates({}); live().setEntityPositions({}); });
    await load(live, 'save-states');
    expect(live().uniqueStates).toEqual(states);
    expect(live().entityPositions).toEqual({ merchant: 'tower', guard: 'keep', watch: 'keep' });
    expect(live().entityFollowers).toEqual(['guard']);
    expect(live().entityWaiting).toEqual(['merchant']);
  });

  it('writes no fields when nobody has a position or a state', () => {
    const live = mount();
    const state = live().saveCurrentGameState();
    expect(['entityPositions', 'uniqueStates'].filter((key) => key in state)).toEqual([]);
  });

  it('places every Unique entity from the engine when a save from before it loads, its followers Following', async () => {
    const live = mount();
    await act(async () => { live().setEntityPositions({ merchant: 'tower', guard: 'tower' }); });
    await save(live, 'save-legacy');
    // A save written before the engine: positions and a followers list, no engine state.
    const record = await getSaveRecord('save-legacy') as SaveRecord;
    const { uniqueStates: _none, ...current } = record.currentState;
    await putSaveRecord({ ...record, currentState: { ...current, locationId: 'tower', entityFollowers: ['guard', 'gone'] } as typeof current });
    // A draw at the bottom of the range would roll the merchant's first Start, at the keep.
    const draw = vi.spyOn(Math, 'random').mockReturnValue(0);
    await load(live, 'save-legacy');
    draw.mockRestore();
    expect(Object.keys(live().uniqueStates).sort()).toEqual(['guard', 'merchant', 'watch']);
    expect(live().entityFollowers).toEqual(['guard']);
    // A saved place that a Start begins at keeps that Start; a follower stays with the player.
    expect(live().entityPositions).toMatchObject({ merchant: 'tower', guard: 'tower', watch: 'keep' });
    expect(live().uniqueStates.merchant.startId).toBe('at-tower');
    expect('entityFollowers' in live().saveCurrentGameState()).toBe(false);
  });

  it('rolls a Start again when the saved one is gone with its deleted location, and drops a deleted entity', async () => {
    const live = mount();
    await act(async () => {
      live().setEntityPositions({ merchant: 'tower', gone: 'keep' });
      live().setUniqueStates({ merchant: { startId: 'at-tower', lastRun: OPENING }, gone: { startId: 'x', lastRun: OPENING } });
    });
    await save(live, 'save-deleted');
    await load(live, 'save-deleted', dropLocationFromEntities('tower', WORLD), [keep]);
    expect(live().uniqueStates.merchant.startId).toBe('at-keep');
    expect(live().entityPositions.merchant).toBe('keep');
    expect('gone' in live().entityPositions || 'gone' in live().uniqueStates).toBe(false);
  });

  it('keeps the met set across a save and a load', async () => {
    const live = mount();
    await act(async () => { live().setMetEntities(['guard', 'merchant']); });
    expect(live().saveCurrentGameState().metEntities).toEqual(['guard', 'merchant']);
    await save(live, 'save-met');
    await act(async () => { live().setMetEntities([]); });
    await load(live, 'save-met');
    expect(live().metEntities).toEqual(['guard', 'merchant']);
    expect('metEntities' in mount()().saveCurrentGameState()).toBe(false);
  });

  it('brings a follower along on a move with no turn, as Map travel makes, and leaves the rest', async () => {
    const live = mount();
    await act(async () => {
      live().setEntityPositions({ merchant: 'keep', guard: 'keep' });
      live().setUniqueStates({
        merchant: { startId: 'at-keep', lastRun: OPENING }, guard: { startId: 'post', lastRun: OPENING, follow: { mode: 'following' } },
      });
    });
    await act(async () => { live().placeCast(positionWorld(castRoutines([merchant, guard]), OPENING, 'tower', LOCATIONS, [])); });
    expect(live().entityPositions).toEqual({ merchant: 'keep', guard: 'tower' });
  });

  it('moves a following runtime character by its own anchor, never a world position', async () => {
    const live = mount();
    const mira = { entity: { id: 'mira', name: 'Mira', aiDescription: 'A ferry hand.' }, locationId: 'keep', sourceTurnId: 't1' };
    await act(async () => {
      live().setDiscoveredEntities([mira]);
      live().setUniqueStates({ mira: { startId: 'discovered', lastRun: OPENING, follow: { mode: 'following' } } });
    });
    await act(async () => { live().placeCast(positionWorld(castRoutines([], [mira]), OPENING, 'tower', LOCATIONS, [])); });
    expect(live().discoveredEntities[0].locationId).toBe('tower');
    expect(live().entityPositions).toEqual({});
  });

  it('gives the played persona no position on load', async () => {
    const live = mount();
    await act(async () => {
      live().setEntityPositions({ merchant: 'tower' });
      live().setPersonaRef({ source: 'world', entityId: 'merchant' });
    });
    await save(live, 'save-persona');
    await load(live, 'save-persona');
    expect('merchant' in live().entityPositions || 'merchant' in live().uniqueStates).toBe(false);
  });
});

describe('Generic Entity Instances in the save', () => {
  // The tower stands in the keep, so a patrol can walk between them.
  const linked = [keep, { ...tower, parentId: 'keep' }];
  // One Start walks the keep and the tower, an hour at each; the other stays at the tower.
  const herd: Entity = {
    id: 'herd', name: 'Herd', kind: 'generic', locations: ['keep', 'tower'],
    starts: [
      { id: 'walker', place: 'keep', weight: 1, schedule: [{
        id: 'walk', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'keep', idle: 60 }, { place: 'tower', idle: 60 }] },
      }] },
      { id: 'sitter', place: 'tower', weight: 1, schedule: [] },
    ],
  };
  const generics = { herd: { walker: { position: 'tower', rowId: 'walk', lastRun: OPENING, idleEnd: OPENING + 30, stop: 1 }, sitter: { position: 'tower', lastRun: OPENING } } };

  it('round-trips each Generic Entity Instance with its Patrol stop and idle end', async () => {
    const live = mount();
    await act(async () => { live().setGenericStates(generics); });
    expect(live().saveCurrentGameState().genericStates).toEqual(generics);
    await save(live, 'save-generic');
    await act(async () => { live().setGenericStates({}); });
    await load(live, 'save-generic', [herd], linked);
    expect(live().genericStates).toEqual(generics);
  });

  // The stored save text: its keys are the shipped save shape.
  const STORED = '{"herd":{"walker":{"position":"tower","rowId":"walk","lastRun":480,"idleEnd":510,"stop":1},"sitter":{"position":"tower","lastRun":480}}}';

  it('loads a stored save at its places and writes the same keys back, byte for byte', async () => {
    const live = mount();
    await act(async () => { live().setGenericStates(generics); });
    await save(live, 'save-generic-stored');
    const record = await getSaveRecord('save-generic-stored') as SaveRecord;
    await putSaveRecord({ ...record, currentState: { ...record.currentState, genericStates: JSON.parse(STORED) } });
    await act(async () => { live().setGenericStates({}); });
    await load(live, 'save-generic-stored', [herd], linked);
    expect(JSON.stringify(live().genericStates)).toBe(STORED);
    expect(live().genericStates.herd.sitter.position).toBe('tower');
    expect(JSON.stringify(live().saveCurrentGameState().genericStates)).toBe(STORED);
  });

  it('begins a Start added after the save at its place, and drops the record of a deleted Start', async () => {
    const live = mount();
    await act(async () => { live().setGenericStates(generics); });
    await save(live, 'save-generic-grown');
    const grown: Entity = { ...herd, starts: [herd.starts![0], { id: 'pup', place: 'keep', weight: 1, schedule: [] }] };
    await load(live, 'save-generic-grown', [grown], linked);
    expect(Object.keys(live().genericStates.herd)).toEqual(['walker', 'pup']);
    expect(live().genericStates.herd.pup.position).toBe('keep');
    expect(live().genericStates.herd.walker).toMatchObject({ position: 'tower', stop: 1, idleEnd: OPENING + 30 });
  });

  it('writes no field when no Generic entity has a Generic Entity Instance', () => {
    expect('genericStates' in mount()().saveCurrentGameState()).toBe(false);
  });
});

describe("the player's starting location in the save", () => {
  const linked = [keep, { ...tower, parentId: 'keep' }];
  const companion: Entity = {
    id: 'kit', name: 'Kit', kind: 'unique', traversable: 'anywhere',
    starts: [{ id: 'beside', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true }],
  };

  it('round-trips the resolved place and the follow state', async () => {
    const live = mount();
    const states: UniqueStates = { kit: { startId: 'beside', lastRun: OPENING, follow: { mode: 'following' } } };
    await act(async () => {
      live().setPlayerStartLocationId('keep');
      live().setEntityPositions({ kit: 'keep' });
      live().setUniqueStates(states);
    });
    expect(live().saveCurrentGameState().playerStartLocationId).toBe('keep');
    await save(live, 'save-start');
    await act(async () => { live().setPlayerStartLocationId(undefined); live().setUniqueStates({}); });
    await load(live, 'save-start', [companion], linked);
    expect(live().playerStartLocationId).toBe('keep');
    expect(live().uniqueStates.kit).toEqual(states.kit);
    expect(live().entityFollowers).toEqual(['kit']);
  });

  /** A save from before the field, with the companion placed at the keep and no engine state for it. */
  const olderSave = async (live: () => Gameplay, id: string, messageHistory: ChatMessage[]) => {
    await act(async () => { live().setEntityPositions({ kit: 'keep' }); });
    await save(live, id);
    const record = await getSaveRecord(id) as SaveRecord;
    const { uniqueStates: _none, playerStartLocationId: _start, ...current } = record.currentState;
    await putSaveRecord({ ...record, messageHistory, currentState: { ...current, locationId: 'tower' } });
  };

  it('resolves a save from before the field to where page one took place, and keeps it', async () => {
    const live = mount();
    await olderSave(live, 'save-page-one', [{ role: 'assistant', content: JSON.stringify({ narration: 'Dawn.', locationId: 'keep' }) }]);
    await load(live, 'save-page-one', [companion], linked);
    expect(live().playerStartLocationId).toBe('keep');
    expect(live().saveCurrentGameState().playerStartLocationId).toBe('keep');
  });

  it('places a companion that begins Following beside the player on such a load, Following', async () => {
    const live = mount();
    await olderSave(live, 'save-no-page', []);
    await load(live, 'save-no-page', [companion], linked);
    expect(live().playerStartLocationId).toBe('tower');
    expect(live().entityPositions.kit).toBe('tower');
    expect(live().entityFollowers).toEqual(['kit']);
  });
});
