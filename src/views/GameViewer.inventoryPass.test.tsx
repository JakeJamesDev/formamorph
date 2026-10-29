import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { parseTurnContent } from '@/lib/turnDigest';
import type { Item, ItemCopy, PlayerStat, Script, World } from '@/types';

/** The Inventory pass on a mounted game: its item timings, and the stats re-roll that replays it. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
// Finding the key lifts Vigor through its When Gained script.
const key: Item = {
  id: 'key', name: 'Brass Key', stackable: false, statEffects: [], traitEffects: [], equipRequires: [],
  scripts: [{ id: 'key-gained', timing: 'gained', code: 'stats.Vigor.value += 5;' }],
};
const lantern: Item = { id: 'lantern', name: 'Lantern', stackable: false, statEffects: [], traitEffects: [], equipRequires: [] };
// An After the AI script that leaves a lantern on the harbor every turn.
const giveLantern: Script = { id: 'give-lantern', timing: 'after', code: 'items.Lantern.give(locations.Harbor);' };
const WORLD: World = { ...harborWorld({ stats: [vigor] }), items: [key, lantern], scripts: [giveLantern] };

const GAIN_KEY = JSON.stringify({ operations: [{ op: 'gain', item: 'Brass Key', quantity: 1, owner: '', to: 'you' }] });

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
/** Each Item Copy as item and place. */
const held = (copies: readonly ItemCopy[]) => copies
  .map((c) => `${c.item.kind === 'item' ? c.item.itemId : 'runtime'}@${c.where.kind}`).sort();
const vigorNow = () => gameplay().globalStats.find((s) => s.id === 'vigor')?.value;

function stubEndpoint() {
  const calls = { inventory: 0, stats: 0 };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('inventory keeper')) {
      calls.inventory += 1;
      return sseResponse(sseReply(GAIN_KEY));
    }
    if (system.includes('stat tracker')) {
      calls.stats += 1;
      return sseResponse(sseReply('{"Global Stats": {"Vigor": 0, "Vigor max": 0}}'));
    }
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Open the door\n2. Wait'));
    return sseResponse(sseReply('You find a brass key under the mat.'));
  }));
  return calls;
}

beforeEach(() => {
  live = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_concurrentTurnRequests', 'true');
});

async function playOneTurn() {
  renderGameViewer(WORLD, { inGameplay: <Probe /> });
  const box = await screen.findByPlaceholderText(/Type your action/);
  const calls = stubEndpoint();
  fireEvent.change(box, { target: { value: 'I look under the mat.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
  return calls;
}

describe('the Inventory pass in a turn', () => {
  it("lands the story's item, fires its When Gained script, and stores the operations on the turn", async () => {
    const calls = await playOneTurn();
    expect(calls.inventory).toBe(1);
    await waitFor(() => expect(held(gameplay().itemCopies)).toEqual(['key@you', 'lantern@location']));
    await waitFor(() => expect(vigorNow()).toBe(55));
    const turn = parseTurnContent(gameplay().fullMessageHistory.findLast((m) => m.role === 'assistant')?.content ?? '');
    expect(turn?.inventoryOps).toEqual([{ op: 'gain', item: 'Brass Key', quantity: 1, owner: '', to: 'you' }]);
  });
});

describe('the stats re-roll', () => {
  it("replays the pass and the After the AI script's item write once each", async () => {
    const calls = await playOneTurn();
    await waitFor(() => expect(vigorNow()).toBe(55));
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(calls.stats).toBe(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
    await waitFor(() => expect(vigorNow()).toBe(55));
    expect(held(gameplay().itemCopies)).toEqual(['key@you', 'lantern@location']);
    // The re-roll replays the saved operations; it sends no second Inventory request.
    expect(calls.inventory).toBe(1);
  });
});
