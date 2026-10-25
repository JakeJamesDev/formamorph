import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import type { PlayerStat, Trait, World } from '@/types';

/** The per-turn settle on a mounted game: a stat-gated trait follows the stat across turns and a stats re-roll. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const number = (id: string, name: string, value: number): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] });

// Calm holds while Rage is under 60 and raises Focus by 10.
const calm: Trait = {
  id: 'calm', name: 'Calm', mode: 'alwaysOn', statChanges: [{ statId: 'focus', value: 10, type: 'starting' }],
  requires: [{ all: [{ kind: 'stat', id: 'rage', operator: '<', value: 60, unit: 'raw' }] }],
};
const WORLD: World = { ...harborWorld({ stats: [number('rage', 'Rage', 50), number('focus', 'Focus', 50)] }), traits: [calm] };

/** What the game holds after each render, and what its latest turn snapshot saved. */
interface Held { on: string[]; rage: number; focus: number }
const seen: Held & { saved: Held | null } = { on: [], rage: 0, focus: 0, saved: null };
let log: { text: string; repeat: number }[] = [];
const held = (traits: readonly Trait[], disabled: readonly string[], stats: readonly PlayerStat[]): Held => ({
  on: traits.filter((t) => !disabled.includes(t.id)).map((t) => t.id),
  rage: stats.find((s) => s.id === 'rage')?.value ?? 0,
  focus: stats.find((s) => s.id === 'focus')?.value ?? 0,
});
function Probe() {
  const { globalTraits, disabledTraitIds, globalStats, logEntries, gameStates } = useGameplay();
  Object.assign(seen, held(globalTraits, disabledTraitIds, globalStats));
  const last = gameStates.at(-1);
  seen.saved = last ? held(last.globalTraits, last.disabledTraitIds ?? [], last.globalStats) : null;
  log = logEntries.map(({ text, repeat }) => ({ text, repeat }));
  return null;
}

/** An endpoint whose stat tracker answers each call with the next of `replies`. */
function stubEndpoint(replies: string[]) {
  let stats = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('stat tracker')) return sseResponse(sseReply(replies[stats++] ?? 'No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    return sseResponse(sseReply('The ferry bell rings.'));
  }));
  return { statCalls: () => stats };
}

beforeEach(() => {
  Object.assign(seen, { on: [], rage: 0, focus: 0, saved: null });
  log = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

/** The game holding `on`, Rage and Focus, with the turn's snapshot saving the same. */
const turnHeld = (on: string[], rage: number, focus: number) => ({ on, rage, focus, saved: { on, rage, focus } });

const reRollReady = () => waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());

async function playTurn(endpoint: { statCalls: () => number }) {
  const calls = endpoint.statCalls();
  fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(endpoint.statCalls()).toBe(calls + 1));
  await reRollReady();
}

describe('the per-turn settle in play', () => {
  it('turns a stat-gated trait on and off with the stat, and settles a stats re-roll', async () => {
    renderGameViewer(WORLD, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    const endpoint = stubEndpoint(['Rage: +5', 'Rage: +20', 'Rage: +20', 'Rage: -30']);

    await playTurn(endpoint);
    await waitFor(() => expect(seen).toEqual(turnHeld(['calm'], 55, 60)));

    await playTurn(endpoint);
    await waitFor(() => expect(seen).toEqual(turnHeld([], 75, 50)));

    // The re-roll replays the turn from its pre-turn state, where Calm was on, and settles once more.
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(endpoint.statCalls()).toBe(3));
    await reRollReady();
    await waitFor(() => expect(seen).toEqual(turnHeld([], 75, 50)));

    await playTurn(endpoint);
    await waitFor(() => expect(seen).toEqual(turnHeld(['calm'], 45, 60)));
    // The re-roll's line follows the turn's with the same text, so the log counts it as a repeat.
    expect(log.filter(({ text }) => text.startsWith('Trait switched'))).toEqual([
      { text: 'Trait switched on: Calm', repeat: 0 }, { text: 'Trait switched off: Calm', repeat: 1 }, { text: 'Trait switched on: Calm', repeat: 0 },
    ]);
  });
});
