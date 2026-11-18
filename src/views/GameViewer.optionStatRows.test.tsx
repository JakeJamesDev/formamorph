import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { ChoiceWorldOption, PlayerStat, World, WorldOptionValue } from '@/types';

/** Option stat rows in play: the start, a switch on the in-play tab, and nothing in the AI request (Q5). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const gold: PlayerStat = { id: 'gold', name: 'Gold', type: 'number', description: '', min: 0, max: 100, value: 10, regen: 1, descriptors: [] };
const easy: WorldOptionValue = {
  id: 'easy', name: 'Easy',
  statChanges: [{ statId: 'gold', type: 'starting', value: 50 }, { statId: 'gold', type: 'max', value: 100 }, { statId: 'gold', type: 'regen', value: 2 }],
};
const hard: WorldOptionValue = { id: 'hard', name: 'Hard', statChanges: [{ statId: 'gold', type: 'max', value: -50 }] };
const difficulty = (values: WorldOptionValue[]): ChoiceWorldOption => ({
  id: 'diff', name: 'Difficulty', type: 'choice', shownToPlayer: true, midGame: true, default: 'easy', values,
});
const worldWith = (values: WorldOptionValue[]): World =>
  ({ ...harborWorld({ stats: [gold] }), options: [difficulty(values)] }) as unknown as World;

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const goldNow = () => gameplay().globalStats.find((s) => s.id === 'gold');

async function start(world: World) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
}

/** The narration request one turn of `world` sends, as text. */
async function narrationRequest(world: World): Promise<string> {
  await start(world);
  const bodies: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    bodies.push(init.body as string);
    const system = (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages
      .find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    return sseResponse(sseReply('The ferry bell rings.'));
  }));
  fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
  return bodies[0];
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('Option stat rows in play', () => {
  it('opens with the default value’s rows applied', async () => {
    await start(worldWith([easy, hard]));
    expect(goldNow()).toMatchObject({ value: 60, max: 200, regen: 3 });
  });

  it('moves max and regen when the in-play tab switches, clamping the value and nothing more', async () => {
    await start(worldWith([easy, hard]));
    gameplay().setActiveTab('options');
    fireEvent.click(await screen.findByRole('radio', { name: 'Hard' }));
    await waitFor(() => expect(goldNow()).toMatchObject({ value: 50, max: 50, regen: 1 }));
    fireEvent.click(screen.getByRole('radio', { name: 'Easy' }));
    await waitFor(() => expect(goldNow()).toMatchObject({ value: 50, max: 200, regen: 3 }));
  });

  it('adds nothing to the AI request but what the stat values carry', async () => {
    // Regen and a toggle on a stat that stays on reach no prompt, so the two requests must match.
    const quiet: WorldOptionValue = { id: 'easy', name: 'Easy', statChanges: [{ statId: 'gold', type: 'regen', value: 2 }], statToggles: [{ statId: 'gold', enabled: true }] };
    const withRows = await narrationRequest(worldWith([quiet]));
    cleanup();
    vi.unstubAllGlobals();
    const without = await narrationRequest(worldWith([{ id: 'easy', name: 'Easy' }]));
    expect(withRows).toBe(without);
  });
});
