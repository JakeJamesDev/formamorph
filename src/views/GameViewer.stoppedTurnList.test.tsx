import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { stubChatLayout } from '@/test/gamePanels';
import { sseFrame, sseReply, sseResponse } from '@/test/aiTextFixtures';
import { bodyFixture } from '@/test/bodyFixture';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { defaultActionListPrompt } from '@/components/game/GamePrompts';
import type { Item, Placement, Slot, World } from '@/types';

/** A turn that fails or is stopped keeps the listed actions it was sent with (ticket 09). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const slots: Slot[] = [{ id: 'head', name: 'Head' }];
const tonic: Item = { id: 'tonic', name: 'Tonic', uses: 1, equipRequires: [], statEffects: [], traitEffects: [] };
const helm: Item = { id: 'helm', name: 'Helm', slotRule: { mode: 'either', slotIds: ['head'] }, statEffects: [], traitEffects: [], equipRequires: [] };
const placements: Placement[] = [
  { id: 'p-tonic', where: { kind: 'you' }, quantity: 3, source: { kind: 'item', itemId: 'tonic' } },
  { id: 'p-helm', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'helm' } },
];
const world: World = {
  ...harborWorld(), items: [tonic, helm], slots,
  bodies: [bodyFixture({ id: 'human', name: 'Humanoid', entries: [{ slotId: 'head' }] })], placements,
};

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};

/**
 * How the narration request answers: in full, with a server error, or held open after `partial` (empty: no
 * text) until the turn is stopped.
 */
type Narration = { kind: 'reply' } | { kind: 'fail' } | { kind: 'hold'; partial: string };
let narration: Narration = { kind: 'reply' };
let opened = 0;
let requests: string[][] = [];
const NARRATION = 'The tide turns under the pier.';

function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages = [] } = JSON.parse(init.body as string) as { messages?: { role: string; content: unknown }[] };
    requests.push(messages.map((m) => text(m.content)));
    const system = text(messages.find((m) => m.role === 'system')?.content);
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Ring the bell\n2. Wait at the dock'));
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes.'));
    if (!system.includes('You are the narrator stage')) return sseResponse(sseReply(NARRATION));
    opened += 1;
    if (narration.kind === 'fail') return new Response('upstream down', { status: 500 });
    if (narration.kind === 'reply') return sseResponse(sseReply(NARRATION));
    const encoder = new TextEncoder();
    const partial = narration.partial;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (partial) controller.enqueue(encoder.encode(sseFrame({ content: partial })));
        init.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
      },
    });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  }));
}

const text = (content: unknown): string => (typeof content === 'string' ? content : JSON.stringify(content ?? ''));
/** The narration requests whose last message tells `line`. */
const toldIn = (line: string) => requests.filter((messages) => messages.at(-1)?.includes(defaultActionListPrompt) && messages.at(-1)?.includes(line));

const box = () => screen.getByPlaceholderText(/Type your action/);
const sendButton = () => screen.getByRole('button', { name: 'Send' });
const tray = () => screen.queryByRole('region', { name: 'Since Last Turn' });
const rowTexts = () => within(tray() as HTMLElement).getAllByRole('listitem').map((row) => row.textContent);
const history = () => gameplay().fullMessageHistory;
const tonics = () => gameplay().itemCopies.find((c) => c.item.kind === 'item' && c.item.itemId === 'tonic')?.quantity ?? 0;
const turnDone = () => waitFor(() => {
  expect(gameplay().isWaitingForAI).toBe(false);
  expect(gameplay().narrationSettled).toBe(true);
});

async function send(action?: string) {
  const turns = closedTurns(history());
  if (action !== undefined) fireEvent.change(box(), { target: { value: action } });
  fireEvent.click(sendButton());
  await waitFor(() => expect(closedTurns(history())).toBe(turns + 1));
  await turnDone();
}

/** Starts a turn through `trigger` with the narration answering as `answer`, stops a held one, and waits for its end. */
async function endTurn(answer: Exclude<Narration, { kind: 'reply' }>, trigger: () => void) {
  narration = answer;
  const before = opened;
  trigger();
  await waitFor(() => expect(opened).toBeGreaterThan(before));
  if (answer.kind === 'hold') {
    const { partial } = answer;
    if (partial) await waitFor(() => expect(history().at(-1)?.content).toContain(partial));
    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
  }
  await turnDone();
  narration = { kind: 'reply' };
}

const typeAndSend = (action: string) => () => {
  fireEvent.change(box(), { target: { value: action } });
  fireEvent.click(sendButton());
};
const sendFailing = (action: string) => endTurn({ kind: 'fail' }, typeAndSend(action));
const sendStopped = (action: string, partial = '') => endTurn({ kind: 'hold', partial }, typeAndSend(action));

async function start() {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
  await waitFor(() => expect(gameplay().itemCopies).toHaveLength(2));
  await send();
  requests = [];
  gameplay().setActiveTab('inventory');
  await screen.findByRole('button', { name: 'Use Tonic' });
}

async function startChat() {
  localStorage.setItem('FORMAMORPH_narrationLayout', 'chat');
  const realScrollTo = HTMLElement.prototype.scrollTo;
  HTMLElement.prototype.scrollTo = () => {};
  onTestFinished(stubChatLayout());
  onTestFinished(() => { HTMLElement.prototype.scrollTo = realScrollTo; });
  await start();
}

async function useTonic() {
  const listed = gameplay().actionList.length;
  await waitFor(() => expect(screen.getByRole('button', { name: 'Use Tonic' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
  await waitFor(() => expect(gameplay().actionList.length).toBeGreaterThan(listed));
}

async function equipHelm() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Equip Helm' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Equip Helm' }));
  await waitFor(() => expect(gameplay().actionList.some((e) => e.facts.kind === 'equip')).toBe(true));
}

const regenerate = () => fireEvent.click(screen.getAllByRole('button', { name: 'Regenerate Narration' }).at(-1)!);

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  requests = [];
  opened = 0;
  narration = { kind: 'reply' };
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => { vi.unstubAllGlobals(); });

const ends = [
  ['fails', (action: string) => sendFailing(action)],
  ['is stopped', (action: string) => sendStopped(action)],
] as const;

describe.each(ends)('a turn that %s before its narration lands', (_, endTurn) => {
  it('gives its list back to the live list, and the next send tells it once', async () => {
    await start();
    await useTonic();
    await endTurn('I wait.');
    expect(closedTurns(history())).toBe(1);
    expect(tonics()).toBe(2);
    await waitFor(() => expect(rowTexts()).toEqual(['Used Tonic']));

    requests = [];
    await send('I wait.');
    expect(toldIn('Used Tonic')).toHaveLength(1);
    expect(tonics()).toBe(2);
    expect(Object.values(gameplay().sentActions).at(-1)?.entries).toHaveLength(1);
  });

  it('leaves the turn before it regenerating from its state at send, its list reopened (Q51)', async () => {
    await start();
    await useTonic();
    await send('I wait.');
    await useTonic();
    await endTurn('I ring the bell.');
    expect(tonics()).toBe(1);

    regenerate();
    await waitFor(() => expect(box()).toHaveValue('I wait.'));
    await waitFor(() => expect(rowTexts()).toEqual(['Used Tonic']));
    expect(tonics()).toBe(2);
    expect(closedTurns(history())).toBe(1);
  });

  it('leaves the turn before it regenerating in Chat from its state at send (Q55)', async () => {
    await startChat();
    await useTonic();
    await send('I wait.');
    await useTonic();
    await endTurn('I ring the bell.');
    const before = requests.length;
    regenerate();
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
    await turnDone();
    expect(closedTurns(history())).toBe(2);
    expect(tonics()).toBe(2);
  });
});

describe('a Chat regenerate that fails', () => {
  it('gives the re-sent list back to the live list, its actions applied, and the next send records it once', async () => {
    await startChat();
    await useTonic();
    await send('I wait.');
    await endTurn({ kind: 'fail' }, regenerate);
    expect(closedTurns(history())).toBe(1);
    expect(tonics()).toBe(2);
    await waitFor(() => expect(gameplay().actionList.map((e) => e.facts.kind)).toEqual(['use']));

    await send('I wait.');
    expect(Object.values(gameplay().sentActions).map((r) => r.entries.length)).toEqual([1]);
    expect(tonics()).toBe(2);
  });
});

describe('a turn stopped after its narration started', () => {
  it('keeps its page and its list, and a regenerate reopens it (Q51)', async () => {
    await start();
    await useTonic();
    await equipHelm();
    await sendStopped('I wait.', 'The tide');
    expect(closedTurns(history())).toBe(2);
    expect(gameplay().actionList).toEqual([]);

    regenerate();
    await waitFor(() => expect(rowTexts()).toEqual(['Used Tonic', 'Equipped Helm']));
    expect(tonics()).toBe(2);
    expect(box()).toHaveValue('I wait.');
  });

  it('regenerates in Chat from its state at send (Q55)', async () => {
    await startChat();
    await useTonic();
    await sendStopped('I wait.', 'The tide');
    const before = requests.length;
    regenerate();
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
    await turnDone();
    expect(closedTurns(history())).toBe(2);
    expect(tonics()).toBe(2);
  });
});
