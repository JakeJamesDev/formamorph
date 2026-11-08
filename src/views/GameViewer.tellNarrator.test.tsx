import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { bodyFixture } from '@/test/bodyFixture';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { defaultActionListPrompt } from '@/components/game/GamePrompts';
import type { Item, Placement, Slot, World } from '@/types';

/** Sending the Action List: shown entries reach the narration request, the sent page keeps the list (ticket 02). */

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

/** Every request body's messages, in send order. */
let requests: { role: string; content: unknown }[][] = [];
const NARRATION = 'The tide turns under the pier.';
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages = [] } = JSON.parse(init.body as string) as { messages?: { role: string; content: unknown }[] };
    requests.push(messages);
    const system = text(messages.find((m) => m.role === 'system')?.content);
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Ring the bell\n2. Wait at the dock'));
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes.'));
    return sseResponse(sseReply(NARRATION));
  }));
}

/** A message's content as text, image parts included as JSON. */
const text = (content: unknown): string => (typeof content === 'string' ? content : JSON.stringify(content ?? ''));
/** The requests whose text holds `needle` anywhere. */
const requestsWith = (needle: string) => requests.filter((messages) => messages.some((m) => text(m.content).includes(needle)));
/** The last message of every request that holds `needle`. */
const lastMessagesWith = (needle: string) => requestsWith(needle).map((messages) => text(messages[messages.length - 1].content));

const box = () => screen.getByPlaceholderText(/Type your action/);
const sendButton = () => screen.getByRole('button', { name: 'Send' });
const tray = () => screen.queryByRole('region', { name: 'Since Last Turn' });
const history = () => gameplay().fullMessageHistory;
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

/** A started game with the Inventory tab open; the opening turn is played. */
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

async function useTonic() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Use Tonic' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Use Tonic' }));
  await waitFor(() => expect(gameplay().actionList).toHaveLength(1));
}

async function equipHelm() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Equip Helm' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Equip Helm' }));
  await waitFor(() => expect(within(tray() as HTMLElement).getAllByRole('listitem')).toHaveLength(2));
}

const hideRow = (index: number) =>
  fireEvent.click(within(tray() as HTMLElement).getAllByRole('button', { name: /from the AI|Tell the AI/ })[index]);

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  requests = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('sending the Action List', () => {
  it('ends the narration request with the wrapper and the shown entries, and no request hears the hidden one', async () => {
    await start();
    await useTonic();
    await equipHelm();
    hideRow(1);
    await send('I wait.');

    expect(lastMessagesWith('Used Tonic')).toHaveLength(1);
    expect(lastMessagesWith('Used Tonic')[0]).toMatch(new RegExp(`^I wait\\.[\\s\\S]*\\n\\n${literal(defaultActionListPrompt)}\\n- Used Tonic$`));
    expect(requestsWith('Equipped Helm')).toEqual([]);
    expect(requestsWith(defaultActionListPrompt)).toHaveLength(1);
  });

  it('keeps the bare action in history, so the next turn does not repeat the block', async () => {
    await start();
    await useTonic();
    await send('I wait.');
    expect(history().some((m) => m.content.includes('Used Tonic'))).toBe(false);
    requests = [];
    await send('I ring the bell.');
    expect(requestsWith('Used Tonic')).toEqual([]);
    expect(requestsWith(defaultActionListPrompt)).toEqual([]);
  });

  it('closes the list on send and shows it on the sent page, the hidden row marked Only You', async () => {
    await start();
    await useTonic();
    await equipHelm();
    hideRow(1);
    await send('I wait.');

    expect(tray()).toBeNull();
    expect(gameplay().actionList).toEqual([]);
    const sent = await screen.findByRole('list', { name: 'Since Last Turn' });
    const rows = within(sent).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Used Tonic', 'Equipped HelmOnly You']);
    expect(within(sent).queryAllByRole('button')).toEqual([]);
    expect(screen.getByTestId('action-line')).toContainElement(sent);
  });

  it('sends with an empty action box only while the list has a shown entry', async () => {
    await start();
    fireEvent.change(box(), { target: { value: '' } });
    await useTonic();
    expect(sendButton()).toBeEnabled();
    hideRow(0);
    expect(sendButton()).toBeDisabled();
    hideRow(0);
    expect(sendButton()).toBeEnabled();

    await send();
    expect(lastMessagesWith('Used Tonic')).toHaveLength(1);
    expect(lastMessagesWith('Used Tonic')[0]).toMatch(/- Used Tonic$/);
    expect(history().filter((m) => m.role === 'user').at(-1)?.content).toBe('');
  });

  it('records each turn’s list, and only the newest keeps its snapshots (Q34)', async () => {
    await start();
    await useTonic();
    await send('I wait.');
    await useTonic();
    await send('I wait again.');
    const records = Object.values(gameplay().sentActions);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.entries.map((e) => e.snapshots?.length ?? 0))).toEqual([[0], [1]]);
    expect(records.every((r) => r.told)).toBe(true);
  });

  it('sends no block on a regenerate (Q35)', async () => {
    await start();
    await useTonic();
    await send('I wait.');
    // A panel action after the send is listed too; neither list reaches the regenerated request.
    await useTonic();
    requests = [];
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Narration' }));
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await turnDone();
    expect(requestsWith('Used Tonic')).toEqual([]);
  });
});

describe('when the list is not told', () => {
  it('tells nothing with thinking on, needs a typed action, and marks the sent rows Only You (Q10, Q32)', async () => {
    localStorage.setItem('FORMAMORPH_thinkingMode', 'inline');
    await start();
    fireEvent.change(box(), { target: { value: '' } });
    await useTonic();
    expect(sendButton()).toBeDisabled();
    await send('I wait.');
    expect(requestsWith('Used Tonic')).toEqual([]);
    const sent = await screen.findByRole('list', { name: 'Since Last Turn' });
    expect(within(sent).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['Used TonicOnly You']);
  });

  it('tells nothing from the Chat layout, and records the entries as untold (Q31)', async () => {
    localStorage.setItem('FORMAMORPH_narrationLayout', 'chat');
    // jsdom has no scrolling; the chat layout scrolls to the latest turn.
    const realScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = () => {};
    onTestFinished(() => { HTMLElement.prototype.scrollTo = realScrollTo; });
    await start();
    fireEvent.change(box(), { target: { value: '' } });
    await useTonic();
    expect(sendButton()).toBeDisabled();
    await send('I wait.');
    expect(requestsWith('Used Tonic')).toEqual([]);
    expect(Object.values(gameplay().sentActions).map((r) => [r.told, r.entries.length])).toEqual([[false, 1]]);
  });
});

/** `text` as a literal inside a RegExp. */
function literal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
