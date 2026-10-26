import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { Placeholder, PlayerStat, World } from '@/types';

/** A stat's `descriptor` reads its band with chips resolved; `previous.descriptor` resolves with the turn-start pins (Q9, Q43). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';

const stat = (over: Partial<PlayerStat> & Pick<PlayerStat, 'id' | 'name' | 'value'>): PlayerStat =>
  ({ type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...over });

const tone: Placeholder = { id: 'tone', name: 'Tone', values: [{ id: 'plain', text: 'plain' }] };
const chip = encodePlaceholderToken({ id: tone.id, mode: 'world', placementId: 'band' });
// The low band pins Tone, so the turn starts under that pin; the AI's change carries Mood into the high band.
const mood = stat({
  id: 'mood', name: 'Mood', value: 10,
  descriptors: [
    { id: 'low', threshold: 20, description: `Low ${chip}`, placeholderPins: [{ placeholderId: tone.id, value: 'dim' }] },
    { id: 'high', threshold: 100, description: `High ${chip}` },
  ],
});
// Banks what the After the AI run read, one bit per check. Its pin lands after the run, so the shown game holds
// a pin the re-roll's pre-turn state lacks.
const check = stat({
  id: 'check', name: 'Check', value: 0, max: 1000,
  scripts: [{
    id: 'check:after', timing: 'after',
    code: [
      'const m = stats.Mood;',
      'const read = (m.previous.descriptor === "Low dim" ? 1 : 0) + (m.descriptor.startsWith("High ") ? 2 : 0)',
      '  + (m.previous.descriptor !== m.descriptor ? 4 : 0) + (m.descriptor === "High " + placeholders.Tone.value ? 8 : 0);',
      'placeholders.Tone.pin("bright");',
      'return read;',
    ].join('\n'),
  }],
});

const world = (): World => ({ ...harborWorld({ stats: [mood, check] }), placeholders: [tone] });

let stats: PlayerStat[] = [];
let statCalls = 0;
function Probe() {
  stats = useGameplay().globalStats;
  return null;
}
const valueOf = (id: string) => stats.find((s) => s.id === id)?.value;

beforeEach(() => {
  stats = [];
  statCalls = 0;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

afterEach(() => vi.restoreAllMocks());

/** An endpoint whose stat tracker raises Mood by 50 on every call. */
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (!system.includes('stat tracker')) return sseResponse(sseReply('The day passes.'));
    statCalls++;
    return sseResponse(sseReply('Mood: +50'));
  }));
}

describe('a stat descriptor in play', () => {
  it('reads the band each side of a crossing, previous resolved with the pins the turn started under', async () => {
    renderGameViewer(world(), { inGameplay: <Probe /> });
    const input = await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint();
    fireEvent.change(input, { target: { value: 'I wait.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    const reRollReady = () => waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());
    await waitFor(() => expect(statCalls).toBe(1));
    await reRollReady();
    await waitFor(() => expect(valueOf('mood')).toBe(60));
    expect(valueOf('check')).toBe(15);

    // The re-roll replays the turn from its pre-turn state, whose pins resolve `previous` the same way.
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statCalls).toBe(2));
    await reRollReady();
    await waitFor(() => expect(valueOf('mood')).toBe(60));
    expect(valueOf('check')).toBe(15);
  });
});
