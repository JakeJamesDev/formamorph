import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { parseTurnContent } from '@/lib/turnDigest';
import type { MemoryNote } from '@/lib/memoryOverrides';
import type { ChatMessage, Entity, PlayerStat, Script, Trait, World } from '@/types';

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
let traitsOn: string[] = [];
let showTraits = () => {};
let showStats = () => {};
let history: ChatMessage[] = [];
let notes: MemoryNote[] = [];
function Probe() {
  const play = useGameplay();
  stats = play.globalStats;
  traitsOn = play.globalTraits.filter((t) => !play.disabledTraitIds.includes(t.id)).map((t) => t.id).sort();
  showTraits = () => play.setActiveTab('traits');
  showStats = () => play.setActiveTab('stats');
  history = play.fullMessageHistory;
  notes = play.memoryNotes;
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

/** A trait's switch in the Traits tab. The Global section starts closed with nothing on, and an off trait sits
 *  under its closed Disabled list. */
async function clickTrait(name: string) {
  showTraits();
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: new RegExp(name) }));
}
const clickBrave = () => clickTrait('Brave');

async function playTurn() {
  stubEndpoint();
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());
}

describe('When a Trait Switches in play', () => {
  it('runs on the player’s switch-on and switch-off, and the write lands at once', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await clickBrave();
    await waitFor(() => expect(vigorNow()).toBe(70));
    // A turn between, so the switch-off is not an undo of the switch-on (Q17).
    act(() => showStats());
    await playTurn();
    await clickBrave();
    await waitFor(() => expect(vigorNow()).toBe(30));
  });

  it('runs when the turn’s settle turns a trait off whose stat gate closed', async () => {
    // Brave needs Vigor at 40 or more; the before box drops Vigor to 10, so the turn's settle switches Brave off.
    const gated: Trait = { ...brave, requires: [{ all: [{ kind: 'stat', id: 'vigor', operator: '>=', value: 40, unit: 'raw' }] }] };
    const drop = { ...vigor, scripts: [{ id: 'drop', timing: 'before' as const, code: 'return 10;' }] };
    renderGameViewer({ ...world(), stats: [drop], traits: [gated] }, { inGameplay: <Probe />, initialTraits: ['brave'] });
    await playTurn();
    await waitFor(() => expect(vigorNow()).toBe(30));
  });

  describe('while the run holds a prompt open', () => {
    // Brave's switch-on asks, then switches Bold and Calm on. Each trait's stat change tells whether it landed.
    const rally: Trait = {
      ...brave,
      scripts: [{ id: 'rally', timing: 'switch', code: 'if (trait.enabled && player.confirm("Rally?")) { traits.Bold.enabled = true; traits.Calm.enabled = true; }' }],
    };
    const plus = (id: string, name: string, value: number): Trait =>
      ({ id, name, playerToggle: true, statChanges: [{ statId: 'vigor', type: 'starting', value }] });

    async function openRally() {
      const traits = [rally, plus('bold', 'Bold', 5), plus('calm', 'Calm', 10), plus('keen', 'Keen', 2)];
      renderGameViewer({ ...harborWorld({ stats: [vigor] }), traits }, { inGameplay: <Probe /> });
      await screen.findByPlaceholderText(/Type your action/);
      await clickBrave();
      await screen.findByRole('group', { name: 'Rally?' });
    }

    it('locks the panel actions and undo until the player answers (Q43)', async () => {
      await openRally();
      const tray = screen.getByRole('region', { name: 'Since Last Turn' });
      expect(within(tray).getByRole('button', { name: 'Undo' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: /Keen/ })).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
      await waitFor(() => expect(traitsOn).toEqual(['bold', 'brave', 'calm']));
      await waitFor(() => expect(within(tray).getByRole('button', { name: 'Undo' })).toBeEnabled());
      expect(screen.getByRole('checkbox', { name: /Keen/ })).toBeEnabled();
    });
  });

  describe('the run’s memory, pin and diary lines', () => {
    const mira: Entity = { id: 'mira', name: 'Mira' };
    const noting: Script = {
      id: 'note', timing: 'switch',
      code: 'if (trait.enabled) { memory.add("Brave stood up."); memory.pin("Brave is sworn."); diary("Mira", "He stood up."); }',
    };
    const notingWorld = (): World => ({ ...harborWorld({ stats: [vigor], entities: [mira] }), traits: [brave], scripts: [noting] });
    const latestTurn = () => parseTurnContent(history.findLast((m) => m.role === 'assistant')?.content ?? '');
    const pinned = () => notes.map((note) => note.text);

    it('land on the latest turn when the player toggles the trait', async () => {
      renderGameViewer(notingWorld(), { inGameplay: <Probe /> });
      await playTurn();
      await clickBrave();
      await waitFor(() => expect(pinned()).toEqual(['Brave is sworn.']));
      expect(notes[0].id).toContain(latestTurn()?.turnId);
      expect(latestTurn()?.codeMemory).toEqual(['Brave stood up.']);
      expect(latestTurn()?.codeDiaries).toEqual({ Mira: ['He stood up.'] });
    });

    it('land on the turn whose settle switched the trait off', async () => {
      // Brave needs Vigor at 40 or more; the before box drops Vigor to 10, so the turn's settle switches Brave off.
      const gated: Trait = { ...brave, requires: [{ all: [{ kind: 'stat', id: 'vigor', operator: '>=', value: 40, unit: 'raw' }] }] };
      const drop = { ...vigor, scripts: [{ id: 'drop', timing: 'before' as const, code: 'return 10;' }] };
      const onOff: Script = { ...noting, code: noting.code.replace('if (trait.enabled)', 'if (!trait.enabled)') };
      renderGameViewer({ ...notingWorld(), stats: [drop], traits: [gated], scripts: [onOff] }, { inGameplay: <Probe />, initialTraits: ['brave'] });
      await playTurn();
      await waitFor(() => expect(pinned()).toEqual(['Brave is sworn.']));
      expect(traitsOn).toEqual([]);
      expect(notes[0].id).toContain(latestTurn()?.turnId);
      expect(latestTurn()?.codeMemory).toEqual(['Brave stood up.']);
      expect(latestTurn()?.codeDiaries).toEqual({ Mira: ['He stood up.'] });
    });

    it('land once, with the batch, for a switch a Before the AI script makes', async () => {
      const rouse: Script = { id: 'rouse', timing: 'before', code: 'traits.Brave.enabled = true;' };
      renderGameViewer({ ...notingWorld(), scripts: [rouse, noting] }, { inGameplay: <Probe /> });
      await playTurn();
      await waitFor(() => expect(traitsOn).toEqual(['brave']));
      expect(latestTurn()?.codeMemory).toEqual(['Brave stood up.']);
      expect(latestTurn()?.codeDiaries).toEqual({ Mira: ['He stood up.'] });
      expect(pinned()).toEqual(['Brave is sworn.']);
    });
  });

  it('does not run for a setup pick, nor on a load of a save', async () => {
    const played = renderGameViewer(world(), { inGameplay: <Probe />, initialTraits: ['brave'] });
    await playTurn();
    expect(vigorNow()).toBe(50);
    await waitFor(async () => expect(await getAllSaveRecords()).toHaveLength(1));
    const [save] = await getAllSaveRecords();
    played.unmount();
    cleanup();

    renderGameViewer(world(), { inGameplay: <Probe />, initialSaveId: save.id });
    await screen.findByRole('button', { name: 'Regenerate Narration' });
    expect(vigorNow()).toBe(50);
  });
});
