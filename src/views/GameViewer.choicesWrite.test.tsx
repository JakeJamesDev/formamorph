import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { parseTurnContent } from '@/lib/turnDigest';
import type { AITurnResult, ChatMessage, PlayerStat, Script, World } from '@/types';

/** An After the AI script's `turn.choices` write on a mounted game: the shown list, the stored turn, and the re-rolls. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const AI = ['Ring the bell', 'Wait at the dock'];
const REDRAWN = ['Swim across', 'Turn back'];
const after = (id: string, code: string): Script => ({ id, timing: 'after', code });
const BOARD = after('board', 'turn.choices.push("Board the ferry");');
// A stat, so the turn asks the stat tracker and offers its re-roll.
const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const worldWith = (scripts: Script[]): World => ({ ...harborWorld({ stats: [vigor] }), scripts });

let play: ReturnType<typeof useGameplay> | null = null;
let history: ChatMessage[] = [];
let choicesOff = () => {};
function Probe() {
  play = useGameplay();
  history = play.fullMessageHistory;
  const settings = useSettings();
  choicesOff = () => settings.setChoicesEnabled(false);
  return null;
}
const live = () => {
  if (!play) throw new Error('gameplay not mounted');
  return play;
};
const latestTurn = (): AITurnResult | null => parseTurnContent(history.findLast((message) => message.role === 'assistant')?.content ?? '');

let statCalls = 0;
let choiceCalls = 0;
/** What every stat request after the first answers. */
let laterStats = 'No changes.';
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) {
      choiceCalls += 1;
      const list = choiceCalls === 1 ? AI : REDRAWN;
      return sseResponse(sseReply(list.map((choice, i) => `${i + 1}. ${choice}`).join('\n')));
    }
    if (system.includes('stat tracker')) {
      statCalls += 1;
      return sseResponse(sseReply(statCalls > 1 ? laterStats : 'No changes.'));
    }
    return sseResponse(sseReply('The ferry bell rings twice across the water.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  statCalls = 0;
  choiceCalls = 0;
  laterStats = 'No changes.';
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

async function send(action: string) {
  const turns = closedTurns(history);
  fireEvent.change(box(), { target: { value: action } });
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

describe('the shown choices', () => {
  it('show the scripted list once the After the AI batch lands, and the turn keeps the AI’s beside it', async () => {
    await enter(worldWith([BOARD]));
    await send('I walk the pier.');
    await waitFor(() => expect(live().choices).toEqual([...AI, 'Board the ferry']));
    expect(latestTurn()).toMatchObject({ choices: [...AI, 'Board the ferry'], aiChoices: AI });
  });

  it('hold the edits of two scripts in run order', async () => {
    const drop = after('drop', 'turn.choices = turn.choices.filter((choice) => choice !== "Wait at the dock");');
    await enter(worldWith([BOARD, drop]));
    await send('I walk the pier.');
    await waitFor(() => expect(live().choices).toEqual(['Ring the bell', 'Board the ferry']));
  });

  it('show the list the earlier scripts left when a later one fails as a bad write', async () => {
    await enter(worldWith([BOARD, after('blank', 'turn.choices.push(" ");')]));
    await send('I walk the pier.');
    await waitFor(() => expect(live().choices).toEqual([...AI, 'Board the ferry']));
    expect(latestTurn()?.choices).toEqual([...AI, 'Board the ferry']);
  });

  it('show none after a script clears them, and the input box still takes an action', async () => {
    await enter(worldWith([after('clear', 'turn.choices = [];')]));
    await send('I walk the pier.');
    await waitFor(() => expect(live().choices).toEqual([]));
    expect(latestTurn()).toMatchObject({ choices: [], aiChoices: AI });
    expect(box()).toBeEnabled();
    await send('I wait.');
    expect(closedTurns(history)).toBe(2);
  });

  it('stay the AI’s, with no AI field, when no script changes them', async () => {
    await enter(worldWith([after('read', 'const seen = turn.choices.length;')]));
    await send('I walk the pier.');
    await waitFor(() => expect(live().choices).toEqual(AI));
    expect(latestTurn()?.choices).toEqual(AI);
    expect(latestTurn()).not.toHaveProperty('aiChoices');
  });

  it('stay as stored with the player’s choices off, where the write drops', async () => {
    await enter(worldWith([BOARD]));
    act(() => choicesOff());
    await send('I walk the pier.');
    expect(latestTurn()).not.toHaveProperty('aiChoices');
    expect(latestTurn()?.choices ?? []).not.toContain('Board the ferry');
  });
});

describe('the save', () => {
  it('keeps the shown list and the AI’s own through a save and a load', async () => {
    const world = worldWith([BOARD]);
    await enter(world);
    await send('I walk the pier.');
    await waitFor(() => expect(live().choices).toEqual([...AI, 'Board the ferry']));
    await act(async () => { await live().saveGame('slot', 'Sedge Landing', 'w1', 'kept'); });
    // Wiped, so the load alone can bring the turn back.
    act(() => live().setFullMessageHistory([]));
    await waitFor(() => expect(closedTurns(history)).toBe(0));
    await act(async () => { await live().loadGame('kept', world.locations, world.stats); });
    await waitFor(() => expect(closedTurns(history)).toBe(1));
    expect(latestTurn()).toMatchObject({ choices: [...AI, 'Board the ferry'], aiChoices: AI });
    await waitFor(() => expect(live().choices).toEqual([...AI, 'Board the ferry']));
  });
});

describe('the re-rolls', () => {
  it('start a stats re-roll’s choice writes from the AI’s list, twice in a row', async () => {
    await enter(worldWith([BOARD]));
    await send('I walk the pier.');
    await rerollStats();
    await rerollStats();
    await waitFor(() => expect(live().choices).toEqual([...AI, 'Board the ferry']));
    expect(latestTurn()).toMatchObject({ choices: [...AI, 'Board the ferry'], aiChoices: AI });
  });

  it('put back the AI’s list and drop its field when a stats re-roll’s scripts no longer change it', async () => {
    await enter(worldWith([after('board', 'if (stats.Vigor.value === 50) turn.choices.push("Board the ferry");')]));
    await send('I walk the pier.');
    await waitFor(() => expect(latestTurn()).toMatchObject({ aiChoices: AI }));
    laterStats = 'Vigor: -5';
    await rerollStats();
    await waitFor(() => expect(live().choices).toEqual(AI));
    expect(latestTurn()?.choices).toEqual(AI);
    expect(latestTurn()).not.toHaveProperty('aiChoices');
  });

  it('store the new draw as the AI’s own list on Re-Roll Choices', async () => {
    await enter(worldWith([BOARD]));
    await send('I walk the pier.');
    fireEvent.click(await screen.findByRole('button', { name: 'Re-generate Choices' }));
    await waitFor(() => expect(latestTurn()?.choices).toEqual(REDRAWN));
    expect(latestTurn()).not.toHaveProperty('aiChoices');
    await turnDone();
    // A stats re-roll then starts from the new draw.
    await rerollStats();
    await waitFor(() => expect(latestTurn()).toMatchObject({ choices: [...REDRAWN, 'Board the ferry'], aiChoices: REDRAWN }));
  });
});
