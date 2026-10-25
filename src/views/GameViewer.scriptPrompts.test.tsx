import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { scriptPrompts } from '@/lib/scriptPrompts';
import type { PlayerStat, Script, World } from '@/types';

/** `player.*` in play: the inline prompt line holds the turn, and a tell stays with its turn and out of requests. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
const toastInfo = vi.hoisted(() => vi.fn());
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: toastInfo, warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const health = (): PlayerStat =>
  ({ id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], value: 10 });

// Each turn tells the bell count, then asks; Yes adds one Health.
const bell: Script = {
  id: 'bell', timing: 'before', name: 'Bell',
  code: 'player.tell("The bell tolls " + stats.Health.value + " times."); player.toast("A bell!"); if (player.confirm("Ring it?")) stats.Health.value += 1;',
};
const world = (): World => ({ ...harborWorld({ stats: [health()] }), scripts: [bell] });

let play: ReturnType<typeof useGameplay> | null = null;
function Probe() {
  play = useGameplay();
  return null;
}
const live = () => play!;

function stubEndpoint() {
  const bodies: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    bodies.push(init.body as string);
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes'));
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    return sseResponse(sseReply('The harbor is quiet.'));
  }));
  return bodies;
}

beforeEach(() => {
  play = null;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

afterEach(() => vi.restoreAllMocks());

async function send(action: string) {
  fireEvent.change(await screen.findByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
}
const settled = () => waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
const tells = () => screen.queryAllByTestId('script-tell').map((line) => line.textContent);
const valueOf = () => live().globalStats.find((s) => s.id === 'health')?.value;

describe('script prompts in play', () => {
  it('holds the turn on the confirm line, and the script reads the pick', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    stubEndpoint();

    await send('I wait.');
    expect(await screen.findByRole('group', { name: 'Ring it?' })).toBeInTheDocument();
    expect(live().isWaitingForAI).toBe(true);
    expect(toastInfo).toHaveBeenCalledWith('A bell!');
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await settled();
    expect(valueOf()).toBe(11);
    expect(screen.queryByTestId('script-prompt')).toBeNull();
  });

  it('keeps each tell with its turn, pages it with that turn, and never sends it', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    const bodies = stubEndpoint();

    await send('I wait.');
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    await settled();
    expect(tells()).toEqual(['The bell tolls 10 times.']);

    await send('I wait more.');
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    await settled();
    expect(tells()).toEqual(['The bell tolls 11 times.']);
    expect(Object.values(live().scriptTells)).toEqual([
      [{ text: 'The bell tolls 10 times.', timing: 'before' }], [{ text: 'The bell tolls 11 times.', timing: 'before' }],
    ]);

    act(() => { live().setUserPage(1); });
    expect(tells()).toEqual(['The bell tolls 10 times.']);

    expect(bodies.length).toBeGreaterThan(2);
    expect(bodies.filter((body) => body.includes('The bell tolls'))).toEqual([]);
  });

  it('replaces a turn’s tells with the re-rolled ones on Re-generate Stats', async () => {
    const ask: Script = { id: 'ask', timing: 'before', code: 'if (player.confirm("Ring it?")) stats.Health.value += 1;' };
    const report: Script = { id: 'report', timing: 'after', code: 'player.tell("Health is " + stats.Health.value + ".");' };
    renderGameViewer({ ...world(), scripts: [ask, report] }, { inGameplay: <Probe /> });
    stubEndpoint();

    await send('I wait.');
    fireEvent.click(await screen.findByRole('button', { name: 'Yes' }));
    await settled();
    expect(tells()).toEqual(['Health is 11.']);

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    await settled();
    await waitFor(() => expect(tells()).toEqual(['Health is 10.']));
    expect(Object.values(live().scriptTells)).toEqual([[{ text: 'Health is 10.', timing: 'after' }]]);
  });

  it('cancels the open prompt on Stop, so the stopped turn ends', async () => {
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGameViewer(world(), { inGameplay: <Probe /> });
    stubEndpoint();

    await send('I wait.');
    await screen.findByRole('group', { name: 'Ring it?' });
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }));
    await waitFor(() => expect(scriptPrompts.pending()).toEqual([]));
    await waitFor(() => expect(live().isWaitingForAI).toBe(false));
    expect(screen.queryByTestId('script-prompt')).toBeNull();
    failure.mockRestore();
  });

  it('cancels an open prompt when the game unmounts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmountView } = renderGameViewer(world(), { inGameplay: <Probe /> });
    stubEndpoint();

    await send('I wait.');
    await screen.findByRole('group', { name: 'Ring it?' });
    unmountView();
    expect(scriptPrompts.pending()).toEqual([]);
  });
});
