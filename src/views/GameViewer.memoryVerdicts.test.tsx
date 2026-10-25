import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { stubChatLayout } from '@/test/gamePanels';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { scriptWorldTool } from '@/test/worldToolFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { parseTurnContent } from '@/lib/turnDigest';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { MemoryEditMap, MemoryNote } from '@/lib/memoryOverrides';
import type { ChatMessage, PlayerStat, Script, Tool, World } from '@/types';

/** A script's verbs on `memories` entries land at commit on the Memory Manager's fields (Q3, Q9, Q18, Q23, Q40). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 99, value: 0, regen: 0, descriptors: [] };
const after = (code: string): Script => ({ id: `after:${code}`, timing: 'after', code });
const before = (code: string): Script => ({ id: `before:${code}`, timing: 'before', code });
const world = (scripts: Script[], tools: Tool[] = []): World => ({ ...harborWorld({ stats: [vigor] }), scripts, tools });

const user = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (turnId: string, summary: string): ChatMessage => ({
  role: 'assistant', content: JSON.stringify({ narration: summary, choices: [], stat_changes: [], turnId, summary }),
});
const SEEDED = [user('a1'), assistant('t1', 's1'), user('a2'), assistant('t2', 's2'), user('a3'), assistant('t3', 's3'), user('a4'), assistant('t4', 's4')];

let play: ReturnType<typeof useGameplay> | null = null;
let pins: Record<string, 'keep' | 'drop'> = {};
let edits: MemoryEditMap = {};
let deleted: string[] = [];
let notes: MemoryNote[] = [];
let history: ChatMessage[] = [];
function Probe() {
  play = useGameplay();
  pins = play.memoryPins;
  edits = play.memoryEdits;
  deleted = play.memoryDeleted;
  notes = play.memoryNotes;
  history = play.fullMessageHistory;
  return null;
}
const vigorNow = () => play?.globalStats.find((s) => s.id === 'vigor')?.value;
const turnIds = () => history.flatMap((m) => (m.role === 'assistant' ? [parseTurnContent(m.content)?.turnId ?? ''] : []));

/** The endpoint, which holds the narration until `release` when `hold` is set and calls the Tools `calls` in order. */
function stubEndpoint({ hold = false, calls = [] as string[] } = {}) {
  let release = () => {};
  const held = hold ? new Promise<void>((resolve) => { release = resolve; }) : Promise.resolve();
  let narrations = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[]; tools?: unknown[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    const replies = body.messages.filter((m) => m.role === 'tool').length;
    if (body.tools?.length && replies < calls.length) {
      return sseResponse([
        sseFrame({ tool_calls: [{ index: 0, id: `call-${replies}`, type: 'function', function: { name: calls[replies], arguments: '{}' } }] }),
        sseFrame({}, 'tool_calls'),
        'data: [DONE]\n\n',
      ]);
    }
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    if (narrations++ === 0) await held;
    return sseResponse(sseReply('The ferry bell rings.'));
  }));
  return { release: () => release() };
}

/** The Memory Manager, opened from the Memory tab. */
async function openMemoryManager() {
  await userEvent.setup().click(await screen.findByRole('tab', { name: 'Memory' }));
  fireEvent.click(await screen.findByRole('button', { name: /Manage Memories/ }));
  return screen.findByRole('dialog', { name: /Memories/ });
}

/** The Memory Manager row that shows `text`. */
function managerRow(dialog: HTMLElement, text: string): HTMLElement {
  let row = within(dialog).getByText(text).parentElement;
  while (row && !within(row).queryByRole('button', { name: 'Delete This Memory' })) row = row.parentElement;
  return row!;
}

/** Switches Brave in the Traits tab, whose Global section starts closed with Brave under its closed Disabled list. */
async function clickBrave() {
  act(() => play?.setActiveTab('traits'));
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: /Brave/ }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  play = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_modelName', MODEL);
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => vi.restoreAllMocks());

async function sendTurn(action: string) {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}
const turnDone = () => waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
async function playTurn(action: string) {
  await sendTurn(action);
  await turnDone();
}

async function seedHistory() {
  await screen.findByPlaceholderText(/Type your action/);
  act(() => play?.setFullMessageHistory(SEEDED));
}

describe('memory verdicts in play', () => {
  it('lands forget, pin, edit and remove on the pins, the overrides and the deleted set, and the Memory Manager shows them', async () => {
    renderGameViewer(world([after('memories[0].forget(); memories[1].pin(); memories[2].edit("The harbor burned."); memories[3].remove();')]), { inGameplay: <Probe /> });
    await seedHistory();
    stubEndpoint();
    await playTurn('I wait.');

    await waitFor(() => expect(deleted).toEqual(['t4']));
    expect(pins).toEqual({ t1: 'drop', t2: 'keep', t3: 'keep' });
    expect(edits).toEqual({ t3: { text: 'The harbor burned.', source: 'player' } });
    expect(notes).toEqual([]);

    const dialog = await openMemoryManager();
    expect(within(dialog).getByText('The harbor burned.')).toBeInTheDocument();
    expect(within(dialog).getByText('Originally: s3')).toBeInTheDocument();
    expect(within(dialog).queryByText('s4')).not.toBeInTheDocument();
    // Each verdict row offers Clear Pin; the dropped row offers Pin, the kept ones Forget.
    expect(within(dialog).getAllByRole('button', { name: 'Clear Pin (Let the Story Decide)' })).toHaveLength(3);
    expect(within(dialog).getAllByRole('button', { name: 'Pin This Memory' })).toHaveLength(1);
  });

  it('drops a pin on a Custom line and edits it in place', async () => {
    renderGameViewer(world([after('const line = memories.find((m) => m.custom); line.pin(); line.edit("The bridge is fixed.");')]), { inGameplay: <Probe /> });
    await seedHistory();
    act(() => play?.setMemoryNotes([{ id: 'n1', text: 'The bridge is out.', anchorTurn: 4 }]));
    stubEndpoint();
    await playTurn('I wait.');

    await waitFor(() => expect(notes).toEqual([{ id: 'n1', text: 'The bridge is fixed.', anchorTurn: 4 }]));
    expect(pins).toEqual({});
    expect(edits).toEqual({});
  });

  it('runs the Before and After scripts of one turn over one capture, whatever the panel does between them', async () => {
    // Before writes 1 when the first row has no verdict; After adds 10 when it still reads none.
    const verdict = '(memories[0].pinned || memories[0].forgotten)';
    renderGameViewer(world([
      before(`stats.Vigor.value = ${verdict} ? 0 : 1;`),
      after(`stats.Vigor.value = stats.Vigor.value + (${verdict} ? 0 : 10);`),
    ]), { inGameplay: <Probe /> });
    await seedHistory();
    const endpoint = stubEndpoint({ hold: true });
    await sendTurn('I wait.');
    await waitFor(() => expect(vigorNow()).toBe(1));
    // The player sets a verdict on the row in the Memory Manager while the narration streams.
    const dialog = await openMemoryManager();
    fireEvent.click(within(managerRow(dialog, 's1')).getByRole('button', { name: /^(Pin|Forget) This Memory$/ }));
    await waitFor(() => expect(pins.t1).toBeDefined());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    endpoint.release();
    await turnDone();
    expect(vigorNow()).toBe(11);
  });

  it('lands a switch run’s verdict at once, and its edit of a Custom line before the first turn', async () => {
    const brave = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };
    const switched: Script = { id: 'sw', timing: 'switch', code: 'const m = memories[0]; if (m.custom) m.edit("The bridge is fixed."); else m.forget();' };
    renderGameViewer({ ...world([switched]), traits: [brave] }, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    act(() => play?.setMemoryNotes([{ id: 'n1', text: 'The bridge is out.', anchorTurn: 0 }]));
    await clickBrave();
    await waitFor(() => expect(notes).toEqual([{ id: 'n1', text: 'The bridge is fixed.', anchorTurn: 0 }]));

    act(() => {
      play?.setMemoryNotes([]);
      play?.setFullMessageHistory(SEEDED);
    });
    await clickBrave();
    await waitFor(() => expect(pins).toEqual({ t1: 'drop' }));
  });

  it.each(['call', 'after'] as const)('lands a %s World Tool’s forget when its turn commits', async (timing) => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'inline');
    localStorage.setItem('FORMAMORPH_toolsEnabled', 'true');
    localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({
      [`${ENDPOINT}|${MODEL}`]: { ...UNKNOWN_REASONING_CAPABILITY, reasons: false, levels: [], tools: true, sources: { reasons: 'native', levels: 'native', tools: 'native' } },
    }));
    const drop: Tool = { ...scriptWorldTool('drop', 'drop', 'memories[0].forget();', timing), offeredTo: ['narration'] };
    renderGameViewer(world([], [drop]), { inGameplay: <Probe /> });
    await seedHistory();
    stubEndpoint({ calls: ['drop'] });
    await playTurn('I forget.');
    await waitFor(() => expect(pins).toEqual({ t1: 'drop' }));
  });

  describe('through a rewind', () => {
    let restore: () => void;
    const realScrollTo = HTMLElement.prototype.scrollTo;
    beforeAll(() => {
      restore = stubChatLayout();
      // jsdom has no scrolling; the chat layout scrolls to the latest turn.
      HTMLElement.prototype.scrollTo = () => {};
    });
    afterAll(() => {
      restore();
      HTMLElement.prototype.scrollTo = realScrollTo;
    });

    /** A turn in the chat layout, whose stat re-roll sits in a menu: done once the turn is stored and play is idle. */
    async function playChatTurn(action: string, turns: number) {
      await sendTurn(action);
      await waitFor(() => expect(turnIds()).toHaveLength(turns));
      await waitFor(() => expect(play?.isWaitingForAI).toBe(false));
    }

    it('keeps the verdict and the edit after a rewind past the turn that wrote them', async () => {
      localStorage.setItem('FORMAMORPH_narrationLayout', 'chat');
      renderGameViewer(world([after('if (memories.length) { memories[0].edit("Rewritten."); memories[0].forget(); }')]), { inGameplay: <Probe /> });
      stubEndpoint();
      await playChatTurn('I arrive.', 1);
      expect(pins).toEqual({});
      await playChatTurn('I wait.', 2);
      const [first] = turnIds();
      await waitFor(() => expect(pins).toEqual({ [first]: 'drop' }));
      expect(edits).toEqual({ [first]: { text: 'Rewritten.', source: 'player' } });

      const turns = await screen.findAllByRole('article');
      fireEvent.click(within(within(turns[0]).getByTestId('bubble-actions')).getByRole('button', { name: 'Rewind to Here' }));
      fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
      await waitFor(() => expect(turnIds()).toEqual([first]));
      expect(pins).toEqual({ [first]: 'drop' });
      expect(edits).toEqual({ [first]: { text: 'Rewritten.', source: 'player' } });
    });
  });
});
