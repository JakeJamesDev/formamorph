import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { ChatMessage, ChoiceWorldOption, Entity, PlayerStat, World, WorldOptionValue } from '@/types';

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

const cracks: PlayerStat = { id: 'cracks', name: 'Cracks', type: 'number', description: '', min: 0, max: 100, value: 5, regen: 0, descriptors: [] };
/** `worldWith` plus a golem at the harbor holding its own stat. */
const golemWorld = (values: WorldOptionValue[], persona = false): World => {
  const golem = { id: 'golem', name: 'Golem', locations: ['harbor'], stats: [cracks], ...(persona && { persona: true, personaOnly: true }) } as unknown as Entity;
  return { ...harborWorld({ stats: [gold], entities: [golem] }), options: [difficulty(values)] } as unknown as World;
};

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const goldNow = () => gameplay().globalStats.find((s) => s.id === 'gold');

async function start(world: World, played = false) {
  // The played entity's stats ride in the stat pass request.
  renderGameViewer(world, {
    inGameplay: <Probe />,
    ...(played && { initialPersona: { ref: { source: 'world', entityId: 'golem' } } }),
  });
  await screen.findByPlaceholderText(/Type your action/);
}

/** The narration and stat pass requests one turn of `world` sends, as text. */
async function turnRequests(world: World, played = false): Promise<{ narration: string; statPass: string }> {
  await start(world, played);
  const bodies: string[] = [];
  const systemOf = (body: string) => (JSON.parse(body) as { messages: { role: string; content: string }[] }).messages
    .find((m) => m.role === 'system')?.content ?? '';
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    bodies.push(init.body as string);
    const system = systemOf(init.body as string);
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    return sseResponse(sseReply('The ferry bell rings.'));
  }));
  fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(bodies.some((b) => systemOf(b).includes('stat tracker'))).toBe(true));
  return {
    narration: bodies.find((b) => !/stat tracker|player choice writer/.test(systemOf(b))) ?? '',
    statPass: bodies.find((b) => systemOf(b).includes('stat tracker')) ?? '',
  };
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

  it('lists a value’s rows on the in-play tab without its starting rows', async () => {
    await start(worldWith([easy, hard]));
    gameplay().setActiveTab('options');
    const tab = await screen.findByTestId('world-options-tab');
    const lines = Array.from(tab.querySelectorAll('li')).map((li) => li.textContent);
    expect(lines).toEqual(['Gold: +100 (max)', 'Gold: +2 (regen)', 'Gold: -50 (max)']);
  });

  it('adds nothing to the AI request but what the stat values carry', async () => {
    // Regen and a toggle on a stat that stays on reach no prompt, so the two requests must match.
    const quiet: WorldOptionValue = {
      id: 'easy', name: 'Easy',
      statChanges: [{ statId: 'gold', type: 'regen', value: 2 }, { statId: 'cracks', type: 'regen', value: 2, ownerId: 'golem' }],
      statToggles: [{ statId: 'gold', enabled: true }, { statId: 'cracks', enabled: true, ownerId: 'golem' }],
    };
    const withRows = await turnRequests(golemWorld([quiet], true), true);
    cleanup();
    vi.unstubAllGlobals();
    const without = await turnRequests(golemWorld([{ id: 'easy', name: 'Easy' }], true), true);
    // The golem's stat is in the request, so the equality below compares real content.
    expect(withRows.statPass).toContain('Cracks');
    expect(withRows.narration).toBe(without.narration);
    expect(withRows.statPass).toBe(without.statPass);
  });

  it('switches a paged-back turn’s entity stats by that turn’s Option value', async () => {
    // Easy, the live value, turns the golem's cracks off; Hard, the viewed turn's, leaves them on.
    const calm: WorldOptionValue = { id: 'easy', name: 'Easy', statToggles: [{ statId: 'cracks', enabled: false, ownerId: 'golem' }] };
    renderGameViewer(golemWorld([calm, { id: 'hard', name: 'Hard' }]), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(gameplay().viewEntityStatEnabled.golem).toEqual({ cracks: false }));
    const before = { ...gameplay().saveCurrentGameState(), worldOptionValues: { diff: 'hard' } };
    act(() => {
      const g = gameplay();
      const turn = (n: number) => [{ role: 'user', content: `go ${n}` }, { role: 'assistant', content: `went ${n}` }] as ChatMessage[];
      g.setFullMessageHistory([...turn(1), ...turn(2)]);
      g.setGameStates([before]);
      g.setUserPage(1);
    });
    await waitFor(() => expect(gameplay().isViewingPast).toBe(true));
    await waitFor(() => expect(gameplay().viewEntityStatEnabled.golem).toEqual({ cracks: true }));
    act(() => gameplay().setUserPage(2));
    await waitFor(() => expect(gameplay().viewEntityStatEnabled.golem).toEqual({ cracks: false }));
  });
});
