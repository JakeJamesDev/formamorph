import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { stubChatLayout } from '@/test/gamePanels';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { bodyFixture } from '@/test/bodyFixture';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { defaultActionListPrompt } from '@/components/game/GamePrompts';
import type { Item, Placement, PlayerStat, Slot, World } from '@/types';

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
async function start(played: World = world) {
  renderGameViewer(played, { inGameplay: <Probe /> });
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

});

const calmValue = () => gameplay().globalStats.find((s) => s.id === 'calm')?.value;
const tonics = () => gameplay().itemCopies.find((c) => c.item.kind === 'item' && c.item.itemId === 'tonic')?.quantity ?? 0;
const rowTexts = () => within(tray() as HTMLElement).getAllByRole('listitem').map((row) => row.textContent);
const regenerate = () => fireEvent.click(screen.getByRole('button', { name: 'Regenerate Narration' }));

describe('regenerating a turn sent with a list (Q14, Q51)', () => {
  it('keeps the listed actions applied and reopens the list, waiting for Send', async () => {
    await start();
    await useTonic();
    await send('I wait.');
    // A panel action after the send belongs to the turn being re-rolled, so it goes with it.
    await useTonic();
    expect(tonics()).toBe(1);
    requests = [];
    regenerate();

    await waitFor(() => expect(rowTexts()).toEqual(['Used Tonic']));
    expect(tonics()).toBe(2);
    expect(box()).toHaveValue('I wait.');
    expect(closedTurns(history())).toBe(1);
    expect(gameplay().isWaitingForAI).toBe(false);
    expect(requests).toEqual([]);

    await send();
    expect(lastMessagesWith('Used Tonic')).toHaveLength(1);
    expect(tonics()).toBe(2);
  });

  it('reopens the entries with their hidden flags, and undo works on them', async () => {
    await start();
    await useTonic();
    await equipHelm();
    hideRow(1);
    await send('I wait.');
    regenerate();

    await waitFor(() => expect(gameplay().actionList.map((e) => e.hidden)).toEqual([false, true]));
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowTexts()).toEqual(['Used Tonic']));
    expect(screen.getByRole('button', { name: 'Equip Helm' })).toBeInTheDocument();
    fireEvent.click(within(tray() as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(tray()).toBeNull());
    expect(tonics()).toBe(3);
  });

  it('sends what the player changed before the resend', async () => {
    await start();
    await useTonic();
    await equipHelm();
    await send('I wait.');
    regenerate();
    await waitFor(() => expect(rowTexts()).toHaveLength(2));
    hideRow(0);
    requests = [];
    await send();
    expect(requestsWith('Used Tonic')).toEqual([]);
    expect(lastMessagesWith('Equipped Helm')).toHaveLength(1);
    expect(Object.values(gameplay().sentActions).at(-1)?.entries.map((e) => e.hidden)).toEqual([true, false]);
  });

  it('re-sends at once when the turn had no list, as before', async () => {
    await start();
    await send('I wait.');
    // A panel action after the send goes with the re-rolled turn, and the re-sent request does not hear it.
    await useTonic();
    requests = [];
    regenerate();
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await turnDone();
    expect(requestsWith('Used Tonic')).toEqual([]);
    expect(tray()).toBeNull();
    expect(tonics()).toBe(3);
  });

  it('starts Regenerate Stats from the state at send, the listed actions applied (Q53)', async () => {
    const calm: PlayerStat = { id: 'calm', name: 'Calm', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
    const scripted: Item = { ...tonic, scripts: [{ id: 'u', timing: 'used', code: 'stats.Calm.value = 90;' }] };
    await start({ ...world, ...harborWorld({ stats: [calm] }), items: [scripted, helm], slots, bodies: world.bodies, placements });
    await useTonic();
    await waitFor(() => expect(calmValue()).toBe(90));
    await send('I wait.');
    requests = [];
    act(() => gameplay().setActiveTab('stats'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Stats' }));
    await waitFor(() => expect(requestsWith('stat tracker').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
    expect(calmValue()).toBe(90);
  });

  it('does not reopen a list on a rollback', async () => {
    await start();
    await useTonic();
    await send('I wait.');
    await send('I ring the bell.');
    fireEvent.click(screen.getByLabelText('Go to previous page'));
    fireEvent.click(await screen.findByRole('button', { name: 'Rewind to Here' }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getAllByRole('button').at(-1)!);
    await waitFor(() => expect(closedTurns(history())).toBe(2));
    expect(tray()).toBeNull();
    expect(gameplay().actionList).toEqual([]);
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

  it('re-sends a Chat regenerate at once, the listed actions kept and untold (Q55)', async () => {
    localStorage.setItem('FORMAMORPH_narrationLayout', 'chat');
    const realScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = () => {};
    // jsdom lays nothing out; the chat list renders its rows only at a measured size.
    onTestFinished(stubChatLayout());
    onTestFinished(() => { HTMLElement.prototype.scrollTo = realScrollTo; });
    await start();
    await useTonic();
    await send('I wait.');
    requests = [];
    fireEvent.click(screen.getAllByRole('button', { name: 'Regenerate Narration' }).at(-1)!);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await turnDone();
    expect(closedTurns(history())).toBe(2);
    expect(requestsWith('Used Tonic')).toEqual([]);
    expect(gameplay().actionList).toEqual([]);
    expect(tonics()).toBe(2);
  });
});

/** `text` as a literal inside a RegExp. */
function literal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
