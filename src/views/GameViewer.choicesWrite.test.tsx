import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { parseTurnContent } from '@/lib/turnDigest';
import { scriptPrompts } from '@/lib/scriptPrompts';
import type { StatCodeTurn } from '@/lib/statCodeTurn';
import { boxScripts } from '@/test/scriptFixtures';
import type { AITurnResult, ChatMessage, PlayerStat, Script, Trait, World } from '@/types';

/** An After the AI script's `turn.choices` write on a mounted game: the shown list, the stored turn, and the re-rolls. */

const { runTurn } = vi.hoisted(() => {
  vi.stubEnv('VITE_DEFAULT_ENDPOINT', '');
  return { runTurn: vi.fn() };
});
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
// Counted, so a test can tell whether a re-roll ran the scripts.
vi.mock('@/lib/statCodeTurn', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/statCodeTurn')>();
  runTurn.mockImplementation(actual.runStatCodeTurn);
  return { ...actual, runStatCodeTurn: runTurn };
});
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
/** Every list the screen held, render by render. */
let shownLists: string[][] = [];
let choicesOff = () => {};
function Probe() {
  play = useGameplay();
  history = play.fullMessageHistory;
  shownLists.push([...play.choices]);
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
/** What the first stat request answers, and every one after it. */
let firstStats = 'No changes.';
let laterStats = 'No changes.';
/** A reply whose stream ends a task after its frames, as a network reply does, so the screen can draw the frames first. */
function lateEndingSse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      setTimeout(() => controller.close(), 20);
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}
/** Whether the redraw waits until the request is stopped. */
let holdRedraw = false;
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) {
      choiceCalls += 1;
      if (choiceCalls > 1 && holdRedraw) {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      const list = choiceCalls === 1 ? AI : REDRAWN;
      const reply = sseReply(list.map((choice, i) => `${i + 1}. ${choice}`).join('\n'));
      return choiceCalls === 1 ? sseResponse(reply) : lateEndingSse(reply);
    }
    if (system.includes('stat tracker')) {
      statCalls += 1;
      return sseResponse(sseReply(statCalls > 1 ? laterStats : firstStats));
    }
    return sseResponse(sseReply('The ferry bell rings twice across the water.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  statCalls = 0;
  choiceCalls = 0;
  firstStats = 'No changes.';
  laterStats = 'No changes.';
  holdRedraw = false;
  shownLists = [];
  runTurn.mockClear();
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

  it('start a stats re-roll from the draw Re-Roll Choices made', async () => {
    await enter(worldWith([BOARD]));
    await send('I walk the pier.');
    await rerollChoices();
    await rerollStats();
    await waitFor(() => expect(latestTurn()).toMatchObject({ choices: [...REDRAWN, 'Board the ferry'], aiChoices: REDRAWN }));
  });
});

/** A world script that acts on the rerun alone: only the redraw offers "Swim across". */
const onRedraw = (id: string, code: string) => after(id, `if (turn.choices.includes("Swim across")) { ${code} }`);
const stat = (name: string) => live().globalStats.find((s) => s.name === name);

async function rerollChoices() {
  const asked = choiceCalls;
  fireEvent.click(await screen.findByRole('button', { name: 'Re-generate Choices' }));
  await waitFor(() => expect(choiceCalls).toBe(asked + 1));
  await turnDone();
}

const ranChoicesOnly = () => runTurn.mock.calls.some(([turn]) => (turn as StatCodeTurn).choicesOnly);

describe('Re-Roll Choices in a world that scripts them', () => {
  it('shows the new draw once, with the script’s removal applied, and the turn keeps both lists', async () => {
    await enter(worldWith([after('drop', 'turn.choices = turn.choices.filter((choice) => choice !== "Turn back");')]));
    await send('I walk the pier.');
    shownLists = [];
    await rerollChoices();
    await waitFor(() => expect(live().choices).toEqual(['Swim across']));
    expect(latestTurn()).toMatchObject({ choices: ['Swim across'], aiChoices: REDRAWN });
    // The draw stayed off screen until the rerun landed.
    expect(shownLists.flat()).not.toContain('Turn back');
    expect(ranChoicesOnly()).toBe(true);
  });

  it('lands no stat write, trait switch or discover from the rerun', async () => {
    const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };
    await enter({
      ...worldWith([onRedraw('rerun', 'stats.Vigor.value = 10; traits.Brave.enabled = true; discover("Ferryman"); turn.choices.push("Dive");')]),
      traits: [brave],
    });
    await send('I walk the pier.');
    const cast = live().discoveredEntities.length;
    await rerollChoices();
    await waitFor(() => expect(live().choices).toEqual([...REDRAWN, 'Dive']));
    expect(stat('Vigor')?.value).toBe(50);
    expect(live().globalTraits.map((trait) => trait.id)).not.toContain('brave');
    expect(live().discoveredEntities).toHaveLength(cast);
  });

  it('answers a confirm with false and shows no tell, and the script’s write after them lands', async () => {
    await enter(worldWith([onRedraw('ask', 'player.tell("Told."); if (!player.confirm("Dive in?")) turn.choices.push("Stay dry");')]));
    await send('I walk the pier.');
    await rerollChoices();
    await waitFor(() => expect(live().choices).toEqual([...REDRAWN, 'Stay dry']));
    expect(scriptPrompts.pending()).toEqual([]);
    expect(Object.values(live().scriptTells).flat()).toEqual([]);
  });

  describe('a script that gates a choice on its stat’s delta', () => {
    const gated = (): World => ({
      ...harborWorld({ stats: [{ ...vigor, scripts: boxScripts({ after: 'if (self.delta.ai.value < 0) turn.choices.push("Rest");' }) }] }),
      scripts: [],
    });

    it('reads the turn’s delta on the rerun, as the original run did', async () => {
      firstStats = 'Vigor: -5';
      await enter(gated());
      await send('I walk the pier.');
      await waitFor(() => expect(live().choices).toEqual([...AI, 'Rest']));
      await rerollChoices();
      await waitFor(() => expect(live().choices).toEqual([...REDRAWN, 'Rest']));
    });

    it('reads it from the stored changes on a turn saved without its asks', async () => {
      firstStats = 'Vigor: -5';
      await enter(gated());
      await send('I walk the pier.');
      await waitFor(() => expect(latestTurn()).toHaveProperty('statAsks'));
      act(() => live().setFullMessageHistory((prev) => prev.map((message, i) => {
        if (i !== prev.length - 1) return message;
        const { statAsks: _dropped, ...older } = parseTurnContent(message.content) as AITurnResult;
        return { ...message, content: JSON.stringify(older) };
      })));
      await waitFor(() => expect(latestTurn()).not.toHaveProperty('statAsks'));
      await rerollChoices();
      await waitFor(() => expect(live().choices).toEqual([...REDRAWN, 'Rest']));
    });
  });

  it('puts the turn’s lists back when stopped', async () => {
    await enter(worldWith([BOARD]));
    await send('I walk the pier.');
    await waitFor(() => expect(live().choices).toEqual([...AI, 'Board the ferry']));
    holdRedraw = true;
    fireEvent.click(await screen.findByRole('button', { name: 'Re-generate Choices' }));
    await waitFor(() => expect(choiceCalls).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }));
    await turnDone();
    await waitFor(() => expect(live().choices).toEqual([...AI, 'Board the ferry']));
    expect(latestTurn()).toMatchObject({ choices: [...AI, 'Board the ferry'], aiChoices: AI });
  });
});

describe('Re-Roll Choices in a world whose After the AI boxes name no turn', () => {
  it('sends the plain request and runs no script', async () => {
    await enter(worldWith([after('tick', 'stats.Vigor.value = stats.Vigor.value - 1;')]));
    await send('I walk the pier.');
    runTurn.mockClear();
    await rerollChoices();
    await waitFor(() => expect(live().choices).toEqual(REDRAWN));
    expect(latestTurn()?.choices).toEqual(REDRAWN);
    expect(latestTurn()).not.toHaveProperty('aiChoices');
    expect(runTurn).not.toHaveBeenCalled();
  });
});

describe('the turn’s asks', () => {
  it('are saved with the turn, and a stats re-roll replaces them', async () => {
    firstStats = 'Vigor: -5';
    await enter(worldWith([]));
    await send('I walk the pier.');
    expect(latestTurn()?.statAsks).toEqual([{ ownerId: null, id: 'vigor', value: -5, max: 0 }]);
    laterStats = 'Vigor: +3';
    await rerollStats();
    await waitFor(() => expect(latestTurn()?.statAsks).toEqual([{ ownerId: null, id: 'vigor', value: 3, max: 0 }]));
    laterStats = 'No changes.';
    await rerollStats();
    await waitFor(() => expect(latestTurn()).not.toHaveProperty('statAsks'));
  });
});
