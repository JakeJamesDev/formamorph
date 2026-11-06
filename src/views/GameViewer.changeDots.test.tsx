import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import userEvent from '@testing-library/user-event';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords, putSaveRecord } from '@/components/modals/dbUtils';
import type { Item, ItemCopy, PlayerStat, SaveRecord, Script, Trait, World } from '@/types';

/** The right rail's dots: a turn's change to the player's stats, traits or inventory, made while that tab is out of sight. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };
const key: Item = { id: 'key', name: 'Brass Key', stackable: false, statEffects: [], traitEffects: [], equipRequires: [] };
/** An After the AI script that takes Brave on the turn it runs. */
const takeBrave: Script = { id: 'take-brave', timing: 'after', code: 'traits.Brave.enabled = true;' };

const world = (over: Partial<World> = {}): World => ({ ...harborWorld({ stats: [vigor] }), traits: [brave], items: [key], ...over });

const GAIN_KEY = JSON.stringify({ operations: [{ op: 'gain', item: 'Brass Key', quantity: 1, owner: '', to: 'you' }] });
const NO_ITEMS = JSON.stringify({ operations: [] });

/** What the next turn's passes answer: the stat tracker's line and the inventory keeper's operations. */
const replies = { stats: 'none', inventory: NO_ITEMS };

function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('location router')) return sseResponse(sseReply('NONE'));
    if (system.includes('You track where one character goes')) return sseResponse(sseReply('Stay'));
    if (system.includes('inventory keeper')) return sseResponse(sseReply(replies.inventory));
    if (system.includes('stat tracker')) return sseResponse(sseReply(replies.stats));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Open the door\n2. Wait'));
    return sseResponse(sseReply('You wait by the water.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  replies.stats = 'none';
  replies.inventory = NO_ITEMS;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_concurrentTurnRequests', 'true');
});
afterEach(() => vi.restoreAllMocks());

const strip = async (side: 'left' | 'right', name: 'Collapse Panel' | 'Dock Panel') => {
  await screen.findByRole('button', { name: 'Hide UI' });
  const strips = screen.getAllByRole('button', { name: /^(Collapse|Dock) Panel$/ });
  const found = side === 'left' ? strips[0] : strips[1];
  expect(found).toHaveAccessibleName(name);
  return found;
};
const rail = (name: 'Story' | 'Status') => screen.getByRole('navigation', { name });
/** Each rail icon's name as a screen reader reads it, dot included. */
const railNames = (name: 'Story' | 'Status') =>
  within(rail(name)).getAllByRole('button').map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim());
const icon = (name: RegExp) => within(rail('Status')).getByRole('button', { name });

let live: ReturnType<typeof useGameplay> | null = null;
/** Reads play state only to know when the turn's passes have landed. */
const Probe = () => { live = useGameplay(); return null; };
const play = (over?: Partial<World>) => renderGameViewer(world(over), { inGameplay: <Probe /> });

/** Plays one turn and waits until every pass it was given has landed. */
async function playTurn(landed: () => void = () => {}) {
  const input = await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
  // A world without Vigor has none to wait on.
  const expectVigor = !live?.globalStats.some((s) => s.id === 'vigor') ? undefined : replies.stats.startsWith('Vigor') ? 55 : 50;
  const expectKey = replies.inventory === GAIN_KEY;
  fireEvent.change(input, { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('You wait by the water.');
  await waitFor(() => {
    expect(live?.globalStats.find((s) => s.id === 'vigor')?.value).toBe(expectVigor);
    expect(live?.itemCopies.some((c) => c.where.kind === 'you')).toBe(expectKey);
    expect(screen.getByPlaceholderText(/Type your action/)).toBeEnabled();
    landed();
  });
}

describe('a dot on the right rail', () => {
  it('marks Stats after a turn changes a stat, and only Stats', async () => {
    play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    fireEvent.click(await strip('left', 'Collapse Panel'));
    replies.stats = 'Vigor: +5';
    await playTurn();

    await waitFor(() => expect(railNames('Status')).toEqual(['Stats, changed', 'Traits', 'Inventory', 'Location']));
    expect(railNames('Story').some((name) => name.includes('changed'))).toBe(false);
  });

  it('marks Traits after a script takes a trait', async () => {
    play({ scripts: [takeBrave] });
    fireEvent.click(await strip('right', 'Collapse Panel'));
    await playTurn();

    await waitFor(() => expect(railNames('Status')).toEqual(['Stats', 'Traits, changed', 'Inventory', 'Location']));
  });

  it('marks Inventory after the inventory pass gives an item', async () => {
    play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    replies.inventory = GAIN_KEY;
    await playTurn();

    await waitFor(() => expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory, changed', 'Location']));
  });

  it('clears only the dot of the tab the drawer opens', async () => {
    play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    replies.stats = 'Vigor: +5';
    replies.inventory = GAIN_KEY;
    await playTurn();
    await waitFor(() => expect(railNames('Status')).toEqual(['Stats, changed', 'Traits', 'Inventory, changed', 'Location']));

    fireEvent.click(icon(/^Inventory/));
    expect(railNames('Status')).toEqual(['Stats, changed', 'Traits', 'Inventory', 'Location']);
    // Closing the drawer leaves the cleared dot cleared.
    fireEvent.click(icon(/^Inventory/));
    expect(railNames('Status')).toEqual(['Stats, changed', 'Traits', 'Inventory', 'Location']);
  });

  it("adds none for a change to the tab the open drawer shows, and marks the drawer's other tabs", async () => {
    play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    fireEvent.click(icon(/^Stats/));
    replies.stats = 'Vigor: +5';
    replies.inventory = GAIN_KEY;
    await playTurn();

    await waitFor(() => expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory, changed', 'Location']));
  });

  it('adds none for a change made while the panel is docked', async () => {
    play();
    replies.stats = 'Vigor: +5';
    replies.inventory = GAIN_KEY;
    await playTurn();
    await waitFor(() => expect(screen.getByText('Vigor')).toBeInTheDocument());

    fireEvent.click(await strip('right', 'Collapse Panel'));
    expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory', 'Location']);
  });

  it('clears a dot when the rail switches the open drawer to its tab', async () => {
    play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    replies.inventory = GAIN_KEY;
    await playTurn();
    await waitFor(() => expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory, changed', 'Location']));

    const user = userEvent.setup();
    await user.click(icon(/^Location/));
    await user.click(icon(/^Inventory/));
    expect(screen.getByRole('region', { name: 'Inventory' })).toBeInTheDocument();
    expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory', 'Location']);
  });

  it('clears the dot of the tab the panel docks on, and keeps the others for the next collapse', async () => {
    play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    replies.stats = 'Vigor: +5';
    replies.inventory = GAIN_KEY;
    await playTurn();
    await waitFor(() => expect(railNames('Status')).toEqual(['Stats, changed', 'Traits', 'Inventory, changed', 'Location']));

    const user = userEvent.setup();
    await user.click(icon(/^Inventory/));
    await user.click(await strip('right', 'Dock Panel'));
    await user.click(within(screen.getByRole('tablist', { name: 'Status' })).getByRole('tab', { name: 'Traits' }));
    await user.click(await strip('right', 'Collapse Panel'));
    expect(railNames('Status')).toEqual(['Stats, changed', 'Traits', 'Inventory', 'Location']);
  });

  it('clears Traits when the panel docks on Traits in place of a missing Stats tab', async () => {
    play({ stats: [], scripts: [takeBrave] });
    fireEvent.click(await strip('right', 'Collapse Panel'));
    await playTurn(() => expect(live?.globalTraits.map((t) => t.id)).toEqual(['brave']));
    await waitFor(() => expect(railNames('Status')).toEqual(['Traits, changed', 'Inventory', 'Location']));

    // The panel's tab is still Stats, which this world lacks, so it docks showing Traits.
    fireEvent.click(await strip('right', 'Dock Panel'));
    expect(within(screen.getByRole('tablist', { name: 'Status' })).getByRole('tab', { selected: true })).toHaveAccessibleName('Traits');
    fireEvent.click(await strip('right', 'Collapse Panel'));
    expect(railNames('Status')).toEqual(['Traits', 'Inventory', 'Location']);
  });

  it('adds none for a change to a stat the player never sees', async () => {
    const secret: PlayerStat = { ...vigor, id: 'secret', name: 'Secret', hidden: true };
    renderGameViewer(world({ stats: [vigor, secret] }), { inGameplay: <Probe /> });
    fireEvent.click(await strip('right', 'Collapse Panel'));
    replies.stats = 'Secret: +5';
    await playTurn(() => expect(live?.globalStats.find((s) => s.id === 'secret')?.value).toBe(55));

    expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory', 'Location']);
  });

  it('starts a loaded game with none, on the loaded state', async () => {
    const view = play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    const carried: ItemCopy = { id: 'k', item: { kind: 'item', itemId: 'key' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' };
    const state = { ...live!.saveCurrentGameState(), fullMessageHistory: undefined, itemCopies: [carried] };
    view.unmount();
    cleanup();
    await putSaveRecord({ id: 'dots', name: 'dots', version: '3.0.1', currentState: state, stateHistory: [] } as unknown as SaveRecord);

    renderGameViewer(world(), { inGameplay: <Probe />, initialSaveId: 'dots' });
    await waitFor(() => expect(live?.logEntries.some((e) => e.text.startsWith('Game loaded'))).toBe(true));
    await waitFor(() => expect(live?.itemCopies).toHaveLength(1));
    expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory', 'Location']);
  });

  it('starts a game with none', async () => {
    const first = play();
    fireEvent.click(await strip('right', 'Collapse Panel'));
    first.unmount();

    play();
    await strip('right', 'Dock Panel');
    expect(railNames('Status')).toEqual(['Stats', 'Traits', 'Inventory', 'Location']);
  });
});
