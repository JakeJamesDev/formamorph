import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { parseTurnContent } from '@/lib/turnDigest';
import type { ChatMessage, Entity, PlayerStat, Script, World } from '@/types';

/** When a turn's choices and the input box show: held through the After the AI batch where a script names `turn`. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const AI = ['Ring the bell', 'Wait at the dock'];
// The confirm holds the After the AI batch open mid-run, so a test reads the screen while the batch has not landed.
const PAUSE = 'player.confirm("Board?");';
const after = (code: string): Script => ({ id: 'after', timing: 'after', code: `${PAUSE} ${code}` });
const worldWith = (script: Script): World => ({ ...harborWorld(), scripts: [script] });

let history: ChatMessage[] = [];
let shownNow: string[] = [];
/** Every choices list the game held during the turn, render by render. */
let shown: string[][] = [];
function Probe() {
  const play = useGameplay();
  history = play.fullMessageHistory;
  shownNow = play.choices;
  if (shown.at(-1) !== play.choices) shown.push(play.choices);
  return null;
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

let observer: MutationObserver | null = null;
afterEach(() => observer?.disconnect());

const box = () => screen.getByPlaceholderText(/Type your action/) as HTMLTextAreaElement;

async function enter(world: World) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) return sseResponse(sseReply(AI.map((choice, i) => `${i + 1}. ${choice}`).join('\n')));
    return sseResponse(sseReply('The ferry bell rings twice across the water.'));
  }));
}

/** Plays one turn up to the script's confirm, reads the screen there, then answers it and lets the turn close. */
async function send(action: string) {
  const unlockedWith: string[][] = [];
  observer = new MutationObserver(() => { if (!box().disabled) unlockedWith.push(shownNow); });
  observer.observe(box(), { attributes: true, attributeFilter: ['disabled'] });
  shown = [];
  fireEvent.change(box(), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByRole('group', { name: 'Board?' });
  const paused = { choices: shownNow, locked: box().disabled };
  fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
  await waitFor(() => expect(closedTurns(history)).toBe(1));
  await waitFor(() => expect(box()).toBeEnabled());
  return { paused, unlockedWith, listed: shown.filter((list) => list.length > 0) };
}

describe('a world whose After the AI scripts name turn', () => {
  it('shows no choice and keeps the input box locked until the batch lands, then shows the scripted list once', async () => {
    await enter(worldWith(after('turn.choices.push("Board the ferry");')));
    const { paused, unlockedWith, listed } = await send('I walk the pier.');
    const scripted = [...AI, 'Board the ferry'];
    expect(paused).toEqual({ choices: [], locked: true });
    expect(listed).toEqual([scripted]);
    expect(unlockedWith[0]).toEqual(scripted);
  });

  it('shows and keeps the AI’s own list when Stop lands before the batch does', async () => {
    // The first script's push stands; Stop cancels the second's confirm, which fails that script alone.
    await enter({ ...harborWorld(), scripts: [{ id: 'board', timing: 'after', code: 'turn.choices.push("Board the ferry");' }, after('')] });
    fireEvent.change(box(), { target: { value: 'I walk the pier.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByRole('group', { name: 'Board?' });
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }));
    await waitFor(() => expect(parseTurnContent(history.at(-1)?.content ?? '')?.choices).toEqual(AI));
    expect(shownNow).toEqual(AI);
  });

  it('holds the list when the only box that names turn sits on an entity’s stat', async () => {
    const mood = {
      id: 'mood', name: 'Mood', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
      scripts: [{ id: 'mood-after', timing: 'after', code: 'const t = turn;' }],
    } as PlayerStat;
    const mara = { id: 'mara', name: 'Mara', locations: ['harbor'], stats: [mood] } as unknown as Entity;
    await enter({ ...harborWorld({ entities: [mara] }), scripts: [after('')] });
    const { paused, listed } = await send('I walk the pier.');
    expect(paused).toEqual({ choices: [], locked: true });
    expect(listed).toEqual([AI]);
  });

  it('holds the AI’s list too when the script only reads turn.action', async () => {
    await enter(worldWith(after('const said = turn.action;')));
    const { paused, unlockedWith, listed } = await send('I walk the pier.');
    expect(paused).toEqual({ choices: [], locked: true });
    expect(listed).toEqual([AI]);
    expect(unlockedWith[0]).toEqual(AI);
  });
});

describe('a world whose After the AI scripts name no turn', () => {
  it('shows the AI’s list once the narration lands, and the input box unlocks with it, before the batch lands', async () => {
    await enter(worldWith(after('const x = 1;')));
    const { paused, unlockedWith, listed } = await send('I walk the pier.');
    expect(paused).toEqual({ choices: AI, locked: false });
    expect(listed).toEqual([AI]);
    expect(unlockedWith[0]).toEqual(AI);
  });
});
