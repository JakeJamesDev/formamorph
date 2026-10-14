import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { PlayerStat, Script, Trait, World } from '@/types';

/** When a Trait Switches on a mounted game: the player's toggle fires it both ways; setup and a load do not. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };

/** Writes 70 on a switch-on and 30 on a switch-off, so the direction shows in the value. */
const switchScript: Script = { id: 'sw', timing: 'switch', code: 'stats.Vigor.value = trait.name === "Brave" ? (trait.enabled ? 70 : 30) : 0;' };

const world = (): World => ({ ...harborWorld({ stats: [vigor] }), traits: [brave], scripts: [switchScript] });

let stats: PlayerStat[] = [];
let showTraits = () => {};
function Probe() {
  const play = useGameplay();
  stats = play.globalStats;
  showTraits = () => play.setActiveTab('traits');
  return null;
}

const vigorNow = () => stats.find((s) => s.id === 'vigor')?.value;

function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const system = (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages
      .find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    return sseResponse(sseReply('The ferry bell rings.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  stats = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => vi.restoreAllMocks());

/** Brave's switch in the Traits tab. The Global section starts closed with nothing on, and an off trait sits
 *  under its closed Disabled list. */
async function clickBrave() {
  showTraits();
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: /Brave/ }));
}

async function playTurn() {
  stubEndpoint();
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled(), { timeout: 8000 });
}

describe('When a Trait Switches in play', () => {
  it('runs on the player’s switch-on and switch-off, and the write lands at once', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await clickBrave();
    await waitFor(() => expect(vigorNow()).toBe(70));
    await clickBrave();
    await waitFor(() => expect(vigorNow()).toBe(30));
  });

  it('runs when the turn’s settle turns a trait off whose stat gate closed', { timeout: 30_000 }, async () => {
    // Brave needs Vigor at 40 or more; the before box drops Vigor to 10, so the turn's settle switches Brave off.
    const gated: Trait = { ...brave, requires: [{ all: [{ kind: 'stat', id: 'vigor', operator: '>=', value: 40, unit: 'raw' }] }] };
    const drop = { ...vigor, scripts: [{ id: 'drop', timing: 'before' as const, code: 'return 10;' }] };
    renderGameViewer({ ...world(), stats: [drop], traits: [gated] }, { inGameplay: <Probe />, initialTraits: ['brave'] });
    await playTurn();
    await waitFor(() => expect(vigorNow()).toBe(30));
  });

  it('does not run for a setup pick, nor on a load of a save', { timeout: 30_000 }, async () => {
    const played = renderGameViewer(world(), { inGameplay: <Probe />, initialTraits: ['brave'] });
    await playTurn();
    expect(vigorNow()).toBe(50);
    await waitFor(async () => expect(await getAllSaveRecords()).toHaveLength(1), { timeout: 8000 });
    const [save] = await getAllSaveRecords();
    played.unmount();
    cleanup();

    renderGameViewer(world(), { inGameplay: <Probe />, initialSaveId: save.id });
    await screen.findByRole('button', { name: 'Re-generate Narration' });
    expect(vigorNow()).toBe(50);
  });
});
