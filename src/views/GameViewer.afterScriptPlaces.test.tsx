import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { migrateEntityRoutine } from '@/lib/version';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn as playOneTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import { useGameplay } from '@/contexts/GameplayContext';
import type { Entity, GameLocation, PlayerStat, World } from '@/types';

/** What an After the AI script reads of the places a turn settled, on a mounted game (Q212, Q218). */

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
const character = (id: string, name: string, locations: string[]): Entity =>
  migrateEntityRoutine({ id, name, locations, movement: 'follow' } as unknown as Entity);
const flag = (id: string): PlayerStat => ({ id, name: id, type: 'number', description: '', min: -1, max: 99, value: -1, regen: 0, descriptors: [] });

/** Each read the After script records, as 1 for true and 0 for false. */
const READS = {
  bramAtWell: 'entities.Bram.location === "Well"',
  bramFollowing: 'entities.Bram.following',
  maelaWaiting: 'entities.Maela.waiting',
  maelaAtVillage: 'entities.Maela.location === "Village"',
  ashaAtWell: 'entities.Asha.location === "Well"',
  wellHasBram: 'locations.Well.present.some((e) => e.name === "Bram")',
  wellHasAsha: 'locations.Well.present.some((e) => e.name === "Asha")',
  wellHasMaela: 'locations.Well.present.some((e) => e.name === "Maela")',
} as const;
type Read = keyof typeof READS;

const world = {
  ...harborWorld({
    stats: [flag('turnNo'), flag('beforeMaelaFollowing'), flag('beforeAshaAtHut'), ...Object.keys(READS).map(flag)],
    entities: [character('asha', 'Asha', ['hut']), character('bram', 'Bram', ['village']), character('maela', 'Maela', ['village'])],
  }),
  locations: [VILLAGE, HUT, WELL],
  scripts: [{
    // The turn's start: Maela still follows and Asha is in her hut.
    id: 'before', timing: 'before',
    code: 'stats.beforeMaelaFollowing.value = entities.Maela.following ? 1 : 0;\nstats.beforeAshaAtHut.value = entities.Asha.location === "Hut" ? 1 : 0;',
  }, {
    id: 'record', timing: 'after',
    code: [
      'stats.turnNo.value = turn.number;',
      ...Object.entries(READS).map(([id, read]) => `stats.${id}.value = (${read}) ? 1 : 0;`),
    ].join('\n'),
  }],
} as unknown as World;

let play: ReturnType<typeof useGameplay>;
function Probe() {
  play = useGameplay();
  return null;
}

beforeEach(resetMoveTurnStorage);

const playTurn = (action: string) => playOneTurn(() => play, action);
const value = (id: string) => play.globalStats.find((s) => s.id === id)?.value;
const recorded = () => Object.fromEntries(Object.keys(READS).map((id) => [id, value(id)])) as Record<Read, number>;

/** The narration request calls `name` once, then writes its reply. */
function callingTool(name: string) {
  const answer = vi.mocked(fetch);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) as { messages: { role: string }[]; tools?: unknown[] } : null;
    if (body?.tools?.length && !body.messages.some((m) => m.role === 'tool')) {
      return sseResponse([
        sseFrame({ tool_calls: [{ index: 0, id: 'call-0', type: 'function', function: { name, arguments: '{}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ]);
    }
    return answer(url, init);
  }));
}

/** The Inventory pass answers `reply` once, then nothing. */
function inventoryAnswering(reply: object[]) {
  const answer = vi.mocked(fetch);
  let asked = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) as { messages: { role: string; content: string }[] } : null;
    if (body?.messages.find((m) => m.role === 'system')?.content.includes('inventory keeper')) {
      const operations = asked ? [] : reply;
      asked = true;
      return sseResponse(sseReply(JSON.stringify({ operations })));
    }
    return answer(url, init);
  }));
}

/**
 * Plays the opening, then the turn that walks to the well: Bram along, Maela left waiting, Asha called over.
 * `router` moves the player before the narration; without it, the narration's move does.
 */
async function walkToTheWell(
  played: World = world, { router = 'NONE', callTool, inventory }: { router?: string; callTool?: string; inventory?: object[] } = {},
) {
  renderGameViewer(played, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubMoveEndpoint('The square is quiet.', { narrated: 'Village' });
  await playTurn('Begin.');
  // Bram and Maela follow the player at the village; Asha is in her hut.
  act(() => play.applyFollowerState({
    positions: { ...play.entityPositions, bram: 'village', maela: 'village' },
    uniques: {
      ...play.uniqueStates,
      bram: { ...play.uniqueStates.bram, follow: { mode: 'following' as const } },
      maela: { ...play.uniqueStates.maela, follow: { mode: 'following' as const } },
    },
    generics: play.genericStates,
  }));

  // The player walks to the well with Bram, Maela waits, and the reply calls Asha over from the hut.
  stubMoveEndpoint('You walk to the well with Bram. Asha comes down from the hut to meet you there.', {
    router, narrated: 'Well',
    entities: { Bram: 'Keep following', Maela: (offered) => offered.find((line) => line.startsWith('Wait here until')) ?? 'Stay' },
  });
  if (callTool) callingTool(callTool);
  if (inventory) inventoryAnswering(inventory);
  await playTurn('Maela, wait here. Bram, come with me to the well.');
}

describe('an After the AI script', () => {
  it('reads the followers, the waiting entity and the pulled entity where the turn settled them', async () => {
    await walkToTheWell();

    expect(play.currentLocation?.id).toBe('well');
    // The game settled the turn this way; the script must read the same.
    expect(play.entityFollowers).toEqual(['bram']);
    expect(play.uniqueStates.maela.follow).toMatchObject({ mode: 'waiting' });
    expect(play.entityPositions.asha).toBe('well');
    expect(value('turnNo')).toBe(2);
    expect([value('beforeMaelaFollowing'), value('beforeAshaAtHut')]).toEqual([1, 1]);
    expect(recorded()).toEqual({
      bramAtWell: 1, bramFollowing: 1,
      maelaWaiting: 1, maelaAtVillage: 1, wellHasMaela: 0,
      ashaAtWell: 1, wellHasBram: 1, wellHasAsha: 1,
    });
  });

  it('reads the routine of that same book: the pull’s hold, and no action for a follower or a waiting entity (Q225)', async () => {
    // Asha wanders her hut, and the well is a place she may go, so the pull holds her there until her idle runs out.
    const wanderer: Entity = {
      id: 'asha', name: 'Asha', kind: 'unique', locations: ['hut'], traversable: ['well'],
      starts: [{ id: 'hut', place: 'hut', weight: 1, schedule: [{
        id: 'w', time: 'allDay', action: { kind: 'wander', places: [{ place: 'hut', weight: 1 }], idle: 600 },
      }] }],
    };
    const routineReads = {
      beforeAshaHeld: 'entities.Asha.held', ashaHeld: 'entities.Asha.held', ashaWanders: 'entities.Asha.action === "wander"',
      bramNoAction: 'entities.Bram.action === "" && !entities.Bram.held', maelaNoAction: 'entities.Maela.action === "" && !entities.Maela.held',
    };
    const record = (timing: 'before' | 'after', ids: string[]) => ({
      id: `routine-${timing}`, timing, code: ids.map((id) => `stats.${id}.value = (${routineReads[id as keyof typeof routineReads]}) ? 1 : 0;`).join('\n'),
    });
    await walkToTheWell({
      ...world,
      stats: [...world.stats, ...Object.keys(routineReads).map(flag)],
      entities: world.entities.map((entity) => (entity.id === 'asha' ? wanderer : entity)),
      scripts: [...world.scripts ?? [], record('before', ['beforeAshaHeld']), record('after', ['ashaHeld', 'ashaWanders', 'bramNoAction', 'maelaNoAction'])],
    });

    expect(play.entityPositions.asha).toBe('well');
    expect(play.uniqueStates.asha.hold).toBeDefined();
    expect(Object.fromEntries(Object.keys(routineReads).map((id) => [id, value(id)]))).toEqual({
      beforeAshaHeld: 0, ashaHeld: 1, ashaWanders: 1, bramNoAction: 1, maelaNoAction: 1,
    });
  });

  it('leaves a Tool call and an output script reading the followers joined at the move, and no pull (Q220)', async () => {
    const calledWorld = {
      ...world,
      stats: [...world.stats, flag('callMaelaWaiting'), flag('callBramFollowing'), flag('callAshaAtWell'), flag('outMaelaWaiting'), flag('outAshaAtWell')],
      scripts: [...world.scripts ?? [], {
        id: 'output', timing: 'output',
        code: 'stats.outMaelaWaiting.value = entities.Maela.waiting ? 1 : 0;\nstats.outAshaAtWell.value = entities.Asha.location === "Well" ? 1 : 0;',
      }],
      tools: [{
        ...scriptWorldTool('look', 'look', [
          'stats.callMaelaWaiting.value = entities.Maela.waiting ? 1 : 0;',
          'stats.callBramFollowing.value = entities.Bram.following ? 1 : 0;',
          'stats.callAshaAtWell.value = entities.Asha.location === "Well" ? 1 : 0;',
        ].join('\n'), 'call'),
        offeredTo: ['narration'],
      }],
    } as unknown as World;
    // The narration's model calls Tools.
    localStorage.setItem('FORMAMORPH_modelName', 'm');
    localStorage.setItem('FORMAMORPH_toolsEnabled', 'true');
    localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({
      'http://127.0.0.1:5190/v1/chat/completions|m': {
        ...UNKNOWN_REASONING_CAPABILITY, reasons: false, levels: [], tools: true, sources: { reasons: 'native', levels: 'native', tools: 'native' },
      },
    }));
    await walkToTheWell(calledWorld, { router: 'Well', callTool: 'look' });

    expect(play.currentLocation?.id).toBe('well');
    expect([value('callMaelaWaiting'), value('callBramFollowing'), value('callAshaAtWell')]).toEqual([1, 1, 0]);
    // A During AI Output script reads the same.
    expect([value('outMaelaWaiting'), value('outAshaAtWell')]).toEqual([1, 0]);
    // The After batch then reads the pull.
    expect(value('ashaAtWell')).toBe(1);
  });

  it('shares its places with an item script the turn’s Inventory pass fires (Q227)', async () => {
    const giftWorld = {
      ...world,
      stats: [...world.stats, flag('giftMaelaWaiting'), flag('giftAshaAtWell')],
      // The player finds a ribbon; an After script sends Maela to the hut at the turn's end.
      items: [{
        id: 'ribbon', name: 'Ribbon', stackable: false, statEffects: [], traitEffects: [], equipRequires: [],
        scripts: [{
          id: 'ribbon-gained', timing: 'gained',
          code: 'stats.giftMaelaWaiting.value = entities.Maela.waiting ? 1 : 0;\nstats.giftAshaAtWell.value = entities.Asha.location === "Well" ? 1 : 0;',
        }],
      }],
      scripts: [...world.scripts ?? [], { id: 'send', timing: 'after', code: 'if (turn.number === 2) entities.Maela.move("Hut");' }],
    } as unknown as World;
    await walkToTheWell(giftWorld, { inventory: [{ op: 'gain', item: 'Ribbon', quantity: 1, owner: '', to: 'you' }] });

    await waitFor(() => expect(value('giftMaelaWaiting')).not.toBe(-1));
    // The turn ended with Maela sent on, but the item script reads her as the After batch did.
    expect(play.entityPositions.maela).toBe('hut');
    expect(play.uniqueStates.maela.follow).toBeUndefined();
    expect([value('giftMaelaWaiting'), value('giftAshaAtWell')]).toEqual([1, 1]);
  });

  it('reads the live places on a stats re-roll (Q219)', async () => {
    await walkToTheWell();
    expect(value('ashaAtWell')).toBe(1);
    // Asha goes back to her hut between the turn and the re-roll.
    act(() => play.applyFollowerState({ ...play.currentBook(), positions: { ...play.currentBook().positions, asha: 'hut' } }));

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Stats' }));

    await waitFor(() => expect(value('ashaAtWell')).toBe(0));
    expect(value('wellHasAsha')).toBe(0);
    expect(value('maelaWaiting')).toBe(1);
  });
});
