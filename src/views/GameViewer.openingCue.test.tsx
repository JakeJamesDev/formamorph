import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords, getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { ChatMessage, PlayerStat, SaveRecord, Script, World } from '@/types';

/** The opening cue the save keeps: what it writes, and what a page-one re-roll reads before and after a reload. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const reading: PlayerStat = { id: 'read', name: 'read', type: 'number', description: '', min: -1, max: 999999, value: -1, regen: 0, descriptors: [] };
/** Each before-box run writes the turn number times 1000, plus the action's length. */
const recorder: Script = { id: 'read:before', timing: 'before', code: 'stats.read.value = turn.number * 1000 + turn.action.length;' };

const actionWorld = (): World => ({ ...harborWorld({ stats: [reading] }), scripts: [recorder] });
const PAGE_ONE = 'Rain drums on the ferry roof.';
const narrationWorld = (): World => {
  const world = actionWorld();
  return { ...world, worldOverview: { ...world.worldOverview, openings: [{ id: 'o-rain', text: PAGE_ONE, kind: 'narration' }] } };
};

let read = NaN;
let history: ChatMessage[] = [];
let play: ReturnType<typeof useGameplay> | null = null;
function Probe() {
  play = useGameplay();
  read = play.globalStats.find((s) => s.id === 'read')?.value ?? NaN;
  history = play.fullMessageHistory;
  return null;
}
const live = () => {
  if (!play) throw new Error('gameplay not mounted');
  return play;
};

let statCalls = 0;
let narrations: string[] = [];
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = init.body as string;
    const { messages } = JSON.parse(body) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Ring the bell\n2. Wait at the dock'));
    if (system.includes('stat tracker')) {
      statCalls += 1;
      return sseResponse(sseReply('No changes.'));
    }
    if (system.includes('narrator stage')) narrations.push(body);
    return sseResponse(sseReply('The ferry bell rings twice across the water.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  statCalls = 0;
  narrations = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

const box = () => screen.getByPlaceholderText(/Type your action/);
const turnDone = () => waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());

async function enter(world: World) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
}

async function send(action?: string) {
  const turns = closedTurns(history);
  if (action !== undefined) fireEvent.change(box(), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(closedTurns(history)).toBe(turns + 1));
  await turnDone();
}

async function rerollStats() {
  const asked = statCalls;
  fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
  await waitFor(() => expect(statCalls).toBe(asked + 1));
  await turnDone();
}

async function saved(id: string): Promise<SaveRecord> {
  await act(async () => { await live().saveGame('slot', 'Sedge Landing', 'w1', id); });
  return await getSaveRecord(id) as SaveRecord;
}

async function reload(id: string, world: World) {
  await act(async () => { await live().loadGame(id, world.locations, world.stats); });
  await turnDone();
}

const OPENING = '  [OOC: keep it short] I walk the pier.  ';
const TRIMMED = OPENING.trim();
const WADE = 'I wade into the shallows.';

describe('the save keeps the opening cue', () => {
  it('writes the cue an Opening Action start sent, edited or not', async () => {
    await enter(actionWorld());
    await send(OPENING);
    expect((await saved('edited')).openingCue).toBe(TRIMMED);
  });

  it('writes the drawn cue on an untouched Opening Action start', async () => {
    await enter(actionWorld());
    await waitFor(() => expect(box()).toHaveValue(OPENING_SCENE_CUE));
    await send();
    expect((await saved('untouched')).openingCue).toBe(OPENING_SCENE_CUE.trim());
  });

  it('writes an empty cue on an Opening Narration start, and a reload reads it empty', async () => {
    const world = narrationWorld();
    await enter(world);
    await waitFor(() => expect(closedTurns(history)).toBe(1));
    await turnDone();
    expect((await saved('narration')).openingCue).toBe('');

    await reload('narration', world);
    await rerollStats();
    expect(read).toBe(1000);
  });
});

describe('a page-one re-roll reads the saved cue', () => {
  it('reads it on a stats re-roll after a reload', async () => {
    const world = actionWorld();
    await enter(world);
    await send(OPENING);
    await saved('reload');
    await reload('reload', world);
    await rerollStats();
    expect(read).toBe(1000 + TRIMMED.length);
  });

  it('reads the cue a full re-roll sends, which replaces the saved one', async () => {
    const world = actionWorld();
    await enter(world);
    await send(OPENING);
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Narration' }));
    await waitFor(() => expect(closedTurns(history)).toBe(0));
    await send(WADE);
    expect(read).toBe(1000 + WADE.length);
    expect((await saved('full')).openingCue).toBe(WADE);

    await reload('full', world);
    await rerollStats();
    expect(read).toBe(1000 + WADE.length);
  });

  it('reads the drawn opening on a save written before the field', async () => {
    const world = actionWorld();
    await enter(world);
    await send(OPENING);
    const { openingCue: _dropped, ...older } = await saved('older');
    await putSaveRecord(older as SaveRecord);
    await reload('older', world);
    await rerollStats();
    expect(read).toBe(1000 + OPENING_SCENE_CUE.trim().length);
  });
});

describe('history keeps the stand-in', () => {
  it('sends turn 2 the same bytes before and after a reload, with the stand-in and never the cue', async () => {
    const world = actionWorld();
    await enter(world);
    await send(OPENING);
    await saved('turn-two');
    await send('I ring the bell.');
    const turnTwoLive = narrations.at(-1) ?? '';

    await reload('turn-two', world);
    await send('I ring the bell.');
    const turnTwoReloaded = narrations.at(-1) ?? '';
    expect(turnTwoReloaded).toBe(turnTwoLive);
    const users = (JSON.parse(turnTwoLive) as { messages: { role: string; content: string }[] }).messages.filter((m) => m.role === 'user');
    expect(users[0]?.content).toBe('START GAME');
    expect(turnTwoLive).not.toContain('I walk the pier');
  });
});
