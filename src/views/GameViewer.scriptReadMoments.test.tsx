import { cleanup, screen, waitFor } from '@testing-library/react';
import { putSaveRecord } from '@/components/modals/dbUtils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import {
  callingTool, offerToolsToNarration, playTurn as playOneTurn, resetMoveTurnStorage, stubMoveEndpoint,
} from '@/test/moveTurns';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { PLAYER_START, type Entity, type GameLocation, type PlayerStat, type SaveRecord, type World } from '@/types';

/** What a script reads of the cast at each moment of a turn, on a mounted game (Q218, Q220, Q232, Q234). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

// A village with two rooms inside it: the hut and the well.
const VILLAGE = { id: 'village', name: 'Village', isStarting: true } as GameLocation;
const HUT = { id: 'hut', name: 'Hut', parentId: 'village' } as GameLocation;
const WELL = { id: 'well', name: 'Well', parentId: 'village' } as GameLocation;
const flag = (id: string): PlayerStat => ({ id, name: id, type: 'number', description: '', min: -1, max: 9999, value: -1, regen: 0, descriptors: [] });

/** Cora stays in her hut, and wanders to the well from 10:00 to 14:00. */
const cora = {
  id: 'cora', name: 'Cora', kind: 'unique', locations: ['hut'],
  starts: [{ id: 'home', place: 'hut', weight: 1, schedule: [
    { id: 'home', time: 'allDay', action: { kind: 'stay', place: 'hut' } },
    { id: 'midday', time: { start: 10 * 60, end: 14 * 60 }, action: { kind: 'wander', places: [{ place: 'well', weight: 1 }], idle: 600 } },
  ] }],
} as unknown as Entity;
/** Dan stays in the hut; the well is a place he may go. */
const dan = {
  id: 'dan', name: 'Dan', kind: 'unique', locations: ['hut'], traversable: ['well'],
  starts: [{ id: 'home', place: 'hut', weight: 1, schedule: [{ id: 'home', time: 'allDay', action: { kind: 'stay', place: 'hut' } }] }],
} as unknown as Entity;
/** Pip begins the story following the player. */
const pip = {
  id: 'pip', name: 'Pip', kind: 'unique', locations: [],
  starts: [{ id: 'beside', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true }],
} as unknown as Entity;

/** A script that records each read as a stat: 1 for true, 0 for false. Only on turn `turnNo` when given. */
const recording = (id: string, timing: string, reads: Record<string, string>, turnNo?: number, extra: string[] = []) => ({
  id, timing,
  code: [
    ...(turnNo === undefined ? [] : [`if (turn.number !== ${turnNo}) return;`]),
    ...Object.entries(reads).map(([stat, read]) => `stats.${stat}.value = (${read}) ? 1 : 0;`),
    ...extra,
  ].join('\n'),
});

const worldOf = (scripts: ReturnType<typeof recording>[], { located = true }: { located?: boolean } = {}) => ({
  ...harborWorld({
    stats: scripts.flatMap((s) => [...s.code.matchAll(/stats\.(\w+)\.value/g)].map((m) => flag(m[1]))),
    entities: [cora, dan, pip],
  }),
  locations: [{ ...VILLAGE, isStarting: located }, HUT, WELL],
  scripts,
}) as unknown as World;

let play: ReturnType<typeof useGameplay>;
function Probe() {
  play = useGameplay();
  return null;
}
beforeEach(resetMoveTurnStorage);

const value = (id: string) => play.globalStats.find((s) => s.id === id)?.value;
const values = (reads: Record<string, string>) => Object.fromEntries(Object.keys(reads).map((id) => [id, value(id)]));

/** Opens the game and plays the opening turn, narrated at `narrated`. */
async function playOpening(played: World, narrated = 'Village') {
  const view = renderGameViewer(played, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubMoveEndpoint('The square is quiet.', { narrated });
  await playOneTurn(() => play, 'Begin.');
  return view;
}

/** Plays the opening, then a turn that keeps the player where they stand. */
async function playTwoTurns(played: World) {
  await playOpening(played);
  stubMoveEndpoint('You wait a while.', { narrated: 'Village' });
  await playOneTurn(() => play, 'Wait.');
}

describe('an At Game Start script', () => {
  it('reads the opening placement: the companion with the player, the scheduled entity at its Start', async () => {
    const reads = {
      pipAtVillage: 'entities.Pip.location === "Village"', pipFollowing: 'entities.Pip.following',
      villageHasPip: 'locations.Village.present.some((e) => e.name === "Pip")',
      coraAtHut: 'entities.Cora.location === "Hut"', coraFollowing: 'entities.Cora.following',
      hutHasCora: 'locations.Hut.present.some((e) => e.name === "Cora")',
      villageHasCora: 'locations.Village.present.some((e) => e.name === "Cora")',
    };
    await playOpening(worldOf([recording('opening', 'start', reads)]));

    expect(values(reads)).toEqual({
      pipAtVillage: 1, pipFollowing: 1, villageHasPip: 1, coraAtHut: 1, coraFollowing: 0, hutHasCora: 1, villageHasCora: 0,
    });
    // The game opened the same way.
    expect(play.entityPositions).toMatchObject({ pip: 'village', cora: 'hut' });
    expect(play.entityFollowers).toEqual(['pip']);
  });
});

describe('an After the AI script', () => {
  it('reads an entity a Before the AI script moved this turn where the move put it (Q232)', async () => {
    const reads = { danAtWell: 'entities.Dan.location === "Well"', danHeld: 'entities.Dan.held', wellHasDan: 'locations.Well.present.some((e) => e.name === "Dan")' };
    await playTwoTurns(worldOf([
      recording('send', 'before', {}, 2, ['entities.Dan.move("Well");']),
      recording('read', 'after', reads, 2),
    ]));

    expect(values(reads)).toEqual({ danAtWell: 1, danHeld: 1, wellHasDan: 1 });
    expect(play.entityPositions.dan).toBe('well');
  });

  it('reads the entity writes of every earlier script of the turn, each timing as the Reference states', async () => {
    const at = (timing: string, id: string, reads: Record<string, string>, extra: string[] = []) => recording(id, timing, reads, 2, extra);
    const danAtWell = 'entities.Dan.location === "Well"';
    const turnTwo = worldOf([
      at('before', 'send', {}, ['entities.Dan.move("Well");', 'stats.sameScriptDanAtWell.value = (entities.Dan.location === "Well") ? 1 : 0;']),
      at('before', 'next-before', { nextBeforeDanAtWell: danAtWell }),
      at('output', 'output', { outputDanAtWell: danAtWell }),
      at('after', 'first-after', { afterDanAtWell: danAtWell }, ['entities.Pip.move("Hut");']),
      at('after', 'next-after', { nextAfterPipAtHut: 'entities.Pip.location === "Hut"', nextAfterPipFollowing: 'entities.Pip.following' }),
    ]);
    const called = {
      ...turnTwo,
      stats: [...turnTwo.stats, flag('toolDanAtWell')],
      tools: [{ ...scriptWorldTool('look', 'look', `stats.toolDanAtWell.value = (${danAtWell}) ? 1 : 0;`, 'call'), offeredTo: ['narration'] }],
    } as unknown as World;
    offerToolsToNarration();
    await playOpening(called);
    stubMoveEndpoint('You wait a while.', { narrated: 'Village' });
    callingTool('look');
    await playOneTurn(() => play, 'Wait.');

    // Later scripts of the timing and the After batch read the move (Q232); the rest read the turn's start.
    expect({
      sameScript: value('sameScriptDanAtWell'), nextBefore: value('nextBeforeDanAtWell'), output: value('outputDanAtWell'),
      tool: value('toolDanAtWell'), after: value('afterDanAtWell'),
      nextAfterPip: [value('nextAfterPipAtHut'), value('nextAfterPipFollowing')],
    }).toEqual({ sameScript: 0, nextBefore: 1, output: 0, tool: 0, after: 1, nextAfterPip: [1, 0] });
    expect(play.entityPositions).toMatchObject({ dan: 'well', pip: 'hut' });
  });

  it('reads on the opening turn the entity an At Game Start script moved, after Before the AI', async () => {
    const reads = { beforeDanAtWell: 'entities.Dan.location === "Well"' };
    await playOpening(worldOf([
      recording('send', 'start', {}, undefined, ['entities.Dan.move("Well");']),
      recording('read', 'before', reads, 1),
      recording('read-after', 'after', { afterDanAtWell: 'entities.Dan.location === "Well"' }, 1),
    ]));

    // Before the AI reads the turn's start (Q220); the move applies at the turn's end, which After the AI reads.
    expect([value('beforeDanAtWell'), value('afterDanAtWell')]).toEqual([0, 1]);
  });

  // The turn begins at 09:00 and lasts three hours, so Cora's midday row starts inside it.
  const crossing = { coraAtHut: 'entities.Cora.location === "Hut"', coraWanders: 'entities.Cora.action === "wander"', coraStays: 'entities.Cora.action === "stay"' };
  const crossingTurn = (located: boolean) => worldOf([
    recording('start-clock', 'before', {}, 2, ['stats.turnBegan.value = clock.hour * 60 + clock.minute;', 'clock.advance(180);']),
    recording('read', 'after', crossing, 2, ['stats.turnEnded.value = clock.hour * 60 + clock.minute;']),
  ], { located });

  it('reads the action that fits the location when the row changes during the turn (Q234)', async () => {
    await playTwoTurns(crossingTurn(true));

    expect([value('turnBegan'), value('turnEnded')]).toEqual([9 * 60, 12 * 60]);
    // With the player at a place, the After book is placed for the turn's end: Cora has left for the well.
    expect(values(crossing)).toEqual({ coraAtHut: 0, coraWanders: 1, coraStays: 0 });
    expect(play.entityPositions.cora).toBe('well');
  });

  it('reads the action of the turn’s start when the player has no location, as its location is (Q234)', async () => {
    // The game was saved at a square the world has since lost, so the save loads with no location.
    const withSquare = crossingTurn(false);
    const square = { id: 'square', name: 'Square', isStarting: true } as GameLocation;
    const opened = await playOpening({ ...withSquare, locations: [...withSquare.locations, square] }, 'Square');
    expect(play.currentLocation?.id).toBe('square');
    const state = play.saveCurrentGameState();
    opened.unmount();
    cleanup();
    await putSaveRecord({ id: 'lost', name: 'lost', version: '3.0.1', currentState: state, stateHistory: [] } as unknown as SaveRecord);
    renderGameViewer(withSquare, { inGameplay: <Probe />, initialSaveId: 'lost' });
    await waitFor(() => expect(play.logEntries.some((e) => e.text.startsWith('Game loaded'))).toBe(true));
    stubMoveEndpoint('You wait a while.', { narrated: 'NONE' });
    await playOneTurn(() => play, 'Wait.');

    expect(play.currentLocation).toBeFalsy();
    expect(play.entityPositions.cora).toBe('well');
    expect([value('turnBegan'), value('turnEnded')]).toEqual([9 * 60, 12 * 60]);
    expect(values(crossing)).toEqual({ coraAtHut: 1, coraWanders: 0, coraStays: 1 });
  });

  it('reads the action and the location of the turn’s end on the opening turn, across a row change', async () => {
    await playOpening(worldOf([
      recording('start-clock', 'before', {}, 1, ['stats.turnBegan.value = clock.hour * 60 + clock.minute;', 'clock.advance(180);']),
      recording('read', 'after', crossing, 1, ['stats.turnEnded.value = clock.hour * 60 + clock.minute;']),
    ]));

    expect([value('turnBegan'), value('turnEnded')]).toEqual([8 * 60, 11 * 60]);
    expect(values(crossing)).toEqual({ coraAtHut: 0, coraWanders: 1, coraStays: 0 });
    expect(play.entityPositions.cora).toBe('well');
  });
});
