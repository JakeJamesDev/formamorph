import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { ChatMessage, PlayerStat, Script, Trait, World } from '@/types';

/** A script in play reads `memories` from the Memory panel's ledger. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 99999, value: 0, regen: 0, descriptors: [] };
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };

/** Writes one digit per entry, oldest first: 3 for a Custom line, 1 pinned, 2 forgotten, 0 plain. */
const reader: Script = {
  id: 'read', timing: 'switch',
  code: 'stats.Vigor.value = Number(memories.map((m) => (m.custom ? 3 : m.pinned ? 1 : m.forgotten ? 2 : 0)).join(""));',
};
const world = (): World => ({ ...harborWorld({ stats: [vigor] }), traits: [brave], scripts: [reader] });

const user = (content: string): ChatMessage => ({ role: 'user', content });
const assistant = (turnId: string, summary: string): ChatMessage => ({
  role: 'assistant', content: JSON.stringify({ narration: summary, choices: [], stat_changes: [], turnId, summary }),
});

let seed = () => {};
let showTraits = () => {};
let vigorNow: number | undefined;
function Probe() {
  const play = useGameplay();
  vigorNow = play.globalStats.find((s) => s.id === 'vigor')?.value;
  showTraits = () => play.setActiveTab('traits');
  seed = () => {
    play.setFullMessageHistory([
      user('a1'), assistant('t1', 's1'), user('a2'), assistant('t2', 's2'), user('a3'), assistant('t3', 's3'), user('a4'), assistant('t4', 's4'),
    ]);
    play.setMemoryPins({ t1: 'keep', t3: 'drop' });
    play.setMemoryDeleted(['t2']);
    play.setMemoryNotes([{ id: 'n1', text: 'The bridge is out.', anchorTurn: 4 }]);
  };
  return null;
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200 })));
});
afterEach(() => vi.restoreAllMocks());

async function clickBrave() {
  showTraits();
  const global = await screen.findByRole('group', { name: 'Global' });
  const header = within(global).getByRole('button', { name: /^Global,/ });
  if (header.getAttribute('aria-expanded') !== 'true') fireEvent.click(header);
  const disabled = within(global).queryByRole('button', { name: /^Disabled/ });
  if (disabled?.getAttribute('aria-expanded') === 'false') fireEvent.click(disabled);
  fireEvent.click(await within(global).findByRole('checkbox', { name: /Brave/ }));
}

describe('memories in play', () => {
  it('reads the ledger’s live rows oldest first, the deleted row absent, verdicts and the Custom line in place', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    act(() => seed());
    await clickBrave();
    // t1 pinned, the note at turn 2, t3 forgotten, t4 plain; t2 deleted.
    await waitFor(() => expect(vigorNow).toBe(1320));
  });
});
