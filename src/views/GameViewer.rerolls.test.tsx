import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { createSurfaceRequester } from '@/test/surfaceRequest';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { transportRequest, type TransportRequest } from '@/lib/aiRequest/requestTransport';
import type { AIRequestType, PlayerStat } from '@/types';

/** The choices and stats re-rolls on a mounted game: their status label, and the request they send. */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

// The real transport, watched: the request a re-roll hands it is what the AI-context viewer captures.
vi.mock('@/lib/aiRequest/requestTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/aiRequest/requestTransport')>();
  return { ...actual, transportRequest: vi.fn(actual.transportRequest) };
});
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };

const WORLD = harborWorld({ stats: [vigor] });

const NARRATION = 'The ferry bell rings twice across the water.';

interface Wire { system: string; user: string; maxTokens: number | undefined }

/** One chat-completions call as the endpoint saw it. */
const wireOf = (init: RequestInit): Wire => {
  const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[]; max_tokens?: number };
  const text = (role: string) => body.messages.find((m) => m.role === role)?.content ?? '';
  return { system: text('system'), user: text('user'), maxTokens: body.max_tokens };
};

const kindOf = (wire: Wire): 'choices' | 'stats' | 'narration' =>
  wire.system.includes('player choice writer') ? 'choices' : wire.system.includes('stat tracker') ? 'stats' : 'narration';

/**
 * A scripted endpoint. Every call is recorded by kind. A call of a kind in `held` waits for `release` after
 * the first, so a test can read the screen while a re-roll is in flight.
 */
function stubEndpoint(held: ReadonlySet<'choices' | 'stats'>) {
  const calls: Record<'choices' | 'stats' | 'narration', Wire[]> = { choices: [], stats: [], narration: [] };
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const replyOf = { narration: NARRATION, choices: '1. Ring the bell\n2. Wait at the dock', stats: 'Vigor: -5' };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const wire = wireOf(init);
    const kind = kindOf(wire);
    calls[kind].push(wire);
    if (kind !== 'narration' && held.has(kind) && calls[kind].length > 1) await gate;
    return sseResponse(sseReply(replyOf[kind]));
  }));
  return { calls, release: () => release() };
}

/** The newest request of `type` the view handed the transport. */
const lastSent = (type: AIRequestType): TransportRequest =>
  vi.mocked(transportRequest).mock.calls.map(([request]) => request).filter((request) => request.type === type).at(-1)!;

let requester: ReturnType<typeof createSurfaceRequester>;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  // The setting that quiets a pass record's label, pinned so the label guard never rests on its default.
  localStorage.setItem('FORMAMORPH_concurrentTurnRequests', 'true');
  requester = createSurfaceRequester();
});

/** Enter the game and play one turn, so the latest turn has narration to re-roll over. */
async function playOneTurn(held: ReadonlySet<'choices' | 'stats'>) {
  renderGameViewer(WORLD, { children: <requester.Requester /> });
  const box = await screen.findByPlaceholderText(/Type your action/);
  // After the render: the harness stubs fetch for the reachability probe.
  const endpoint = stubEndpoint(held);
  fireEvent.change(box, { target: { value: 'I ring the bell.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  // The re-roll buttons wake once the reveal ends and the turn's passes are done.
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Re-generate Choices' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled();
  });
  return endpoint;
}

describe('the choices re-roll', () => {
  it('sends the live turn\'s choices request and shows its own status label', async () => {
    const endpoint = await playOneTurn(new Set(['choices']));
    expect(endpoint.calls.choices).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Choices' }));
    await waitFor(() => expect(endpoint.calls.choices).toHaveLength(2));
    expect(await screen.findByText('Generating Choices…')).toBeInTheDocument();

    endpoint.release();
    await waitFor(() => expect(screen.queryByText('Generating Choices…')).toBeNull());
    expect(endpoint.calls.choices[1]).toEqual(endpoint.calls.choices[0]);
    // The viewer captures what the transport got: the pass record's anatomy rides, and the label is on.
    expect(lastSent('choices')).toMatchObject({ quiet: false, silent: false });
    expect(lastSent('choices').anatomy).toBeDefined();
  });
});

describe('the stats re-roll', () => {
  it('sends the live turn\'s stats request and shows its own status label', async () => {
    const endpoint = await playOneTurn(new Set(['stats']));
    expect(endpoint.calls.stats).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(endpoint.calls.stats).toHaveLength(2));
    expect(await screen.findByText('Generating Stat Updates…')).toBeInTheDocument();

    endpoint.release();
    await waitFor(() => expect(screen.queryByText('Generating Stat Updates…')).toBeNull());
    expect(endpoint.calls.stats[1].maxTokens).toBe(endpoint.calls.stats[0].maxTokens);
    // The turn moved Vigor 50 → 45, and the re-roll reads the stat as it stands; nothing else differs.
    expect(endpoint.calls.stats[0].system).toContain('**Vigor:** 50/100');
    expect(endpoint.calls.stats[1].system.replace('**Vigor:** 45/100', '**Vigor:** 50/100')).toBe(endpoint.calls.stats[0].system);
    expect(endpoint.calls.stats[1].user).toBe(endpoint.calls.stats[0].user);
    expect(lastSent('statUpdates')).toMatchObject({ quiet: false, silent: false });
    expect(lastSent('statUpdates').anatomy).toBeDefined();
  });
});
