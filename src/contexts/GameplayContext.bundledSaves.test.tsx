// Real in-memory storage for saves; must load before anything touches `indexedDB`.
import 'fake-indexeddb/auto';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { daypartAt, storyMinute } from '@/lib/gameClock';
import { DEFAULT_WORLDS, seedWorldData } from '@/lib/defaultWorlds';
import { positionedCast } from '@/lib/entityPresence';
import { castRoutines } from '@/lib/entityKind';
import { placeAll, positionWorld } from '@/lib/positionPlay';
import { settleTraitsWithItems } from '@/lib/inventory';
import { openingFold } from '@/lib/openingState';
import { inPlayOwners } from '@/lib/ownedTraitsInPlay';
import { resolveStartingLocation } from '@/lib/startingLocation';
import { playStatWorld } from '@/lib/statLinks';
import { entityStatTraitsInForce, type GatedTraitResult, type TraitRuntimeState, type TraitWorld } from '@/lib/traitRuntime';
import { useSettleOnSaveLoad } from '@/lib/useSettleOnSaveLoad';
import { PRE_EXPANSION_SHA, PRE_REFRESH_SHA, withoutAStat, worldAt } from '@/test/bundledRevisions';
import type { ChatMessage, PersonaRef, Trait, World } from '@/types';
import { GameDataProvider, useGameDataActions } from './GameDataContext';
import { GameplayProvider, useGameplay } from './GameplayContext';
import { PlaceholderSessionProvider } from './PlaceholderSessionContext';

/** A save made against a bundled world's older revision loads against the current file, and its load settle holds. */

vi.mock('@/lib/useTtsPlayback', () => import('@/test/stubs/ttsPlayback'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const raws = import.meta.glob<string>('@/defaultworlds/*.json', { query: '?raw', import: 'default', eager: true });
const currentRaw = (id: string): Record<string, unknown> =>
  JSON.parse(Object.entries(raws).find(([path]) => path.endsWith(`/${id}.json`))![1]);

const NO_PERSONA: PersonaRef = { source: 'none' };
const nameOf = (trait: Trait) => trait.name;
const reply = JSON.stringify({ narration: 'The wind shifts and the scene holds still.', choices: [], stat_changes: [] });
const TURNS: ChatMessage[] = [
  { role: 'user', content: 'I look around.' },
  { role: 'assistant', content: reply },
  { role: 'user', content: 'I keep going.' },
  { role: 'assistant', content: reply },
];
const VERDICTS = { seen: ['turn-1'], selected: null };

const playWorldOf = (world: World) => playStatWorld({ stats: world.stats ?? [], statGroups: world.statGroups ?? [], entities: world.entities ?? [] });

type Gameplay = ReturnType<typeof useGameplay>;
interface Live {
  gameplay: Gameplay;
  /** The load settle's arguments on the live state, as the view hands them over. */
  gates: (ref?: PersonaRef) => TraitWorld;
  settle: (state: TraitRuntimeState, world: TraitWorld, name: (trait: Trait) => string) => GatedTraitResult;
  state: TraitRuntimeState;
}

/** The view's load settle: the real hook and the real settle, over the live state and `world`'s gates. */
function Play({ world, expose, onSettle }: { world: World; expose: (live: Live) => void; onSettle: () => void }) {
  const gameplay = useGameplay();
  const { personaRef, itemCopies, itemEffects, bodies, gameTime, calendar, globalStats, globalTraits, disabledTraitIds, appliedTraitValues, cascadeOffTraitIds, ownedTraits, entityStats } = gameplay;
  const { setGlobalStats, setGlobalTraits, setDisabledTraitIds, setAppliedTraitValues, setCascadeOffTraitIds, setOwnedTraits, setEntityStats, setItemCopies, setItemEffects, setBodies, gameStates, setGameStates } = gameplay;
  const { entities } = useMemo(() => playWorldOf(world), [world]);

  const gates = useCallback((ref: PersonaRef = personaRef ?? NO_PERSONA): TraitWorld => ({
    traits: world.traits ?? [], groups: world.traitGroups ?? [], persona: ref, daypart: daypartAt(gameTime, calendar), items: world.items ?? [], itemCopies, entities,
    ...inPlayOwners({ traits: world.traits ?? [], traitGroups: world.traitGroups ?? [], entities }, ref),
  }), [world, personaRef, gameTime, calendar, itemCopies, entities]);
  const state = useMemo<TraitRuntimeState>(() => ({
    stats: globalStats, traits: globalTraits, disabledTraitIds, appliedValues: appliedTraitValues, cascadeOffTraitIds, ownedTraits, entityStats,
  }), [globalStats, globalTraits, disabledTraitIds, appliedTraitValues, cascadeOffTraitIds, ownedTraits, entityStats]);
  const settle = useCallback((from: TraitRuntimeState, at: TraitWorld, name: (trait: Trait) => string) => settleTraitsWithItems(
    from, { copies: itemCopies, ledger: itemEffects, now: gameTime, bodies },
    { items: world.items ?? [], traits: at, entities, nameOf: name, bodies: { slots: world.slots, bodies: world.bodies, entities } },
  ), [world, entities, itemCopies, itemEffects, gameTime, bodies]);
  const countedSettle = useCallback<typeof settle>((...args) => { onSettle(); return settle(...args); }, [settle, onSettle]);
  const commit = useCallback((result: GatedTraitResult) => {
    setGlobalStats(result.state.stats);
    setGlobalTraits(result.state.traits);
    setDisabledTraitIds(result.state.disabledTraitIds);
    setAppliedTraitValues(result.state.appliedValues);
    setCascadeOffTraitIds(result.state.cascadeOffTraitIds ?? {});
    setOwnedTraits(result.state.ownedTraits ?? {});
    setEntityStats(result.state.entityStats ?? {});
    if (!result.items) return;
    setItemCopies([...result.items.copies]);
    setItemEffects(result.items.ledger);
    setBodies(result.items.bodies);
  }, [setGlobalStats, setGlobalTraits, setDisabledTraitIds, setAppliedTraitValues, setCascadeOffTraitIds, setOwnedTraits, setEntityStats, setItemCopies, setItemEffects, setBodies]);
  const history = useMemo(() => ({ states: gameStates, commit: setGameStates }), [gameStates, setGameStates]);

  useSettleOnSaveLoad(gameplay.saveLoads, true, state, gates, nameOf, commit, history, countedSettle);
  expose({ gameplay, gates, settle, state });
  return null;
}

/** Loads the world into GameData first, the way the main menu does before it enters the game. */
function WithWorld({ world, children }: { world: World; children: ReactNode }) {
  const { loadWorldData } = useGameDataActions();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadWorldData(world);
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, as an entry does
  return ready ? children : null;
}

function mount(world: World) {
  let live: Live | null = null;
  const settles = { count: 0 };
  const view = render(
    <GameDataProvider>
      <PlaceholderSessionProvider>
        <WithWorld world={world}>
          <GameplayProvider>
            <Play world={world} expose={(l) => { live = l; }} onSettle={() => { settles.count += 1; }} />
          </GameplayProvider>
        </WithWorld>
      </PlaceholderSessionProvider>
    </GameDataProvider>,
  );
  return {
    ...view,
    settles,
    live: () => {
      if (!live) throw new Error('contexts not available (did the render throw?)');
      return live as Live;
    },
  };
}

/** Start a new game on `world`, as the view's first render does, commit two turns and write their autosave. */
async function saveTwoTurns(world: World): Promise<string> {
  const { live, unmount } = mount(world);
  const locations = world.locations ?? [];
  await act(async () => {
    const { gameplay } = live();
    const opening = openingFold(world);
    const { entities } = playWorldOf(world);
    gameplay.setGlobalStats(opening.traitState.stats);
    gameplay.setGlobalTraits(opening.traitState.traits);
    gameplay.setAppliedTraitValues(opening.traitState.appliedValues);
    gameplay.setOwnedTraits(opening.traitState.ownedTraits ?? {});
    gameplay.resetEntityStats(opening.entityStats);
    gameplay.setItemCopies(opening.state.itemCopies ?? []);
    gameplay.setItemEffects(opening.itemEffects.ledger);
    gameplay.setBodies(opening.bodies);
    gameplay.setPersonaRef(NO_PERSONA);
    const start = resolveStartingLocation(locations, undefined);
    const book = placeAll({ positions: {}, individuals: {} }, positionWorld(
      castRoutines(positionedCast(entities, NO_PERSONA)), storyMinute(0), start?.id, locations, world.connections ?? [],
    ));
    gameplay.setEntityPositions(book.positions);
    gameplay.setIndividualStates(book.individuals);
    if (start) gameplay.changeLocation(start);
    gameplay.setFullMessageHistory(TURNS);
    gameplay.setMilestoneSelection(VERDICTS);
    gameplay.setIsGameStarted(true);
  });
  await act(async () => {
    const snapshot = live().gameplay.saveCurrentGameState();
    live().gameplay.setGameStates([snapshot, snapshot]);
  });
  let saved = false;
  await act(async () => { saved = await live().gameplay.autosaveGame(world.worldOverview.name, world.id, 2); });
  expect(saved).toBe(true);
  const [save] = await getAllSaveRecords();
  unmount();
  cleanup();
  return save.id;
}

/** Load `saveId` against `world`, wait for its settle, and hand back the live state. */
async function loadAndSettle(saveId: string, world: World) {
  const { live, settles } = mount(world);
  const { stats, entities } = playWorldOf(world);
  let loaded = false;
  await act(async () => {
    const { gameplay, gates } = live();
    loaded = await gameplay.loadGame(saveId, world.locations ?? [], stats, entities, world.worldOverview.vrmStore, world.items ?? [],
      (state, persona) => (ownerId) => entityStatTraitsInForce(state.ownedTraits ?? {}, gates(persona), ownerId));
  });
  expect(loaded).toBe(true);
  await waitFor(() => expect(settles.count).toBe(1));
  return { live, stats, entities };
}

async function expectLoadedAndSettled(saveId: string, world: World) {
  const { live, stats, entities } = await loadAndSettle(saveId, world);
  const { gameplay, gates, settle, state } = live();

  // The turn came through whole.
  expect(gameplay.fullMessageHistory).toEqual(TURNS);
  expect(gameplay.gameStates).toHaveLength(2);
  expect(gameplay.milestoneSelection).toEqual(VERDICTS);
  expect(gameplay.isGameStarted).toBe(true);
  expect(gameplay.saveLoads).toBe(1);

  // The current world's stats and positions hold.
  expect(gameplay.globalStats.map((s) => s.id)).toEqual(expect.arrayContaining(stats.map((s) => s.id)));
  for (const entity of entities) {
    expect(gameplay.entityStats[entity.id]?.map((s) => s.id) ?? []).toEqual(expect.arrayContaining((entity.stats ?? []).map((s) => s.id)));
  }
  const places = new Set((world.locations ?? []).map((l) => l.id));
  for (const where of Object.values(gameplay.entityPositions)) expect(places.has(where)).toBe(true);
  if (gameplay.currentLocation) expect(places.has(gameplay.currentLocation.id)).toBe(true);

  // The settle reached the current world's gates, so one more has nothing left to change.
  expect(settle(state, gates(), nameOf).state).toBe(state);
  expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  vi.mocked(toast.error).mockClear();
  localStorage.clear();
});

describe.each(DEFAULT_WORLDS.map((seed) => [seed.id, seed] as const))('a save of %s', (id, seed) => {
  const before = (sha: string) => seedWorldData(worldAt(sha, id), seed);
  const after = () => seedWorldData(currentRaw(id), seed);

  it.each([['pre-refresh', PRE_REFRESH_SHA], ['pre-expansion', PRE_EXPANSION_SHA]])(
    'made at the %s revision loads against the current world and settles', { timeout: 60_000 }, async (_label, sha) => {
      await expectLoadedAndSettled(await saveTwoTurns(before(sha)), after());
    },
  );

  // Q10: drift is accepted, so a stat the world cut leaves the load and its settle unbroken.
  it.runIf(withoutAStat(after()))('settles after the world cuts a stat the save holds', { timeout: 60_000 }, async () => {
    await expectLoadedAndSettled(await saveTwoTurns(before(PRE_REFRESH_SHA)), withoutAStat(after())!);
  });
});
