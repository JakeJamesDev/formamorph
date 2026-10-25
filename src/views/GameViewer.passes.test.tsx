import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { ChatMessage, Entity } from '@/types';

/** The silent passes on a mounted game: what the status row shows, what a diary request carries, what a regenerate writes. */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
/** Every AI request the view sent, as the promise of its reply. */
const transports = vi.hoisted((): Promise<unknown>[] => []);
vi.mock('@/lib/aiRequest/requestTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/aiRequest/requestTransport')>();
  return {
    ...actual,
    transportRequest: (...args: Parameters<typeof actual.transportRequest>) => {
      const reply = actual.transportRequest(...args);
      transports.push(reply);
      return reply;
    },
  };
});
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

type Kind = 'digest' | 'diary' | 'other';

const kindOf = (body: string): Kind =>
  body.includes('Now record what this turn changed') ? 'digest' : body.includes('writing a private diary') ? 'diary' : 'other';

const REPLY: Record<Kind, string> = {
  digest: 'You rang the bell.',
  diary: 'He watched the bell.',
  other: 'The ferry bell rings twice across the water.',
};

/** The user message of one chat-completions body. */
const userMessageOf = (body: string): string =>
  (JSON.parse(body) as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === 'user')?.content ?? '';

/** A scripted endpoint. Every call is recorded by kind; a call of a kind in `held` waits for `release`. */
function stubEndpoint(held: ReadonlySet<Kind>) {
  const calls: Record<Kind, string[]> = { digest: [], diary: [], other: [] };
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = init.body as string;
    const kind = kindOf(body);
    calls[kind].push(body);
    if (held.has(kind)) await gate;
    return sseResponse(sseReply(REPLY[kind]));
  }));
  return { calls, release: () => release() };
}

/** Writes a stored turn into the live history, the way a played turn would leave it. */
let seedHistory: (history: ChatMessage[]) => void;
let memoryEditsNow: () => Record<string, unknown>;
function Seed() {
  const { setFullMessageHistory, memoryEdits } = useGameplay();
  seedHistory = setFullMessageHistory;
  memoryEditsNow = () => memoryEdits;
  return null;
}

const storedTurn = (turn: Record<string, unknown>): ChatMessage[] => [
  { role: 'user', content: 'I ring the bell.' },
  {
    role: 'assistant',
    content: serializeTurnContent({ narration: 'Aldric nods at the bell.', choices: [], stat_changes: [], turnId: 't1', ...turn }),
  },
];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

describe('the Background Pass Status row', () => {
  /** Plays one turn with Concurrent Requests off, so the turn's digest is left to the queue, and holds it. */
  async function playUntilDigestHeld(showSilentRequests: boolean) {
    localStorage.setItem('FORMAMORPH_concurrentTurnRequests', 'false');
    localStorage.setItem('FORMAMORPH_showSilentRequests', String(showSilentRequests));
    renderGameViewer(harborWorld());
    const box = await screen.findByPlaceholderText(/Type your action/);
    // After the render: the harness stubs fetch for the reachability probe.
    const endpoint = stubEndpoint(new Set(['digest']));
    fireEvent.change(box, { target: { value: 'I ring the bell.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(endpoint.calls.digest).toHaveLength(1));
    return endpoint;
  }

  it('names the running digest with Show Silent Requests on', async () => {
    const endpoint = await playUntilDigestHeld(true);
    expect(await screen.findByText('Summarizing turn…')).toBeInTheDocument();
    endpoint.release();
    await waitFor(() => expect(screen.queryByText('Summarizing turn…')).toBeNull());
  });

  it('stays blank for the same running digest with it off', async () => {
    const endpoint = await playUntilDigestHeld(false);
    // The queue publishes the pass as it starts it, and the store's re-render is synchronous.
    expect(screen.queryByText('Summarizing turn…')).toBeNull();
    endpoint.release();
  });
});

describe('a diary written under a variant name', () => {
  it('carries the text of the entity the variant names', async () => {
    localStorage.setItem('FORMAMORPH_characterDiaries', 'true');
    localStorage.setItem('FORMAMORPH_thinkingMode', 'staged');
    const aldric = { id: 'aldric', name: 'Sergeant Aldric', aiDescription: 'A scarred veteran who guards the bell tower.' } as Entity;
    renderGameViewer(harborWorld({ entities: [aldric] }), { inGameplay: <Seed /> });
    await screen.findByPlaceholderText(/Type your action/);
    const endpoint = stubEndpoint(new Set());
    act(() => seedHistory(storedTurn({ entities: ['Aldric'] })));

    await waitFor(() => expect(endpoint.calls.diary).toHaveLength(1));
    const request = userMessageOf(endpoint.calls.diary[0]);
    expect(request).toContain('Aldric');
    expect(request).toContain('A scarred veteran who guards the bell tower.');
  });
});

describe('regenerating a memory', () => {
  it('writes no edit when the game view is gone before the reply lands', async () => {
    const view = renderGameViewer(harborWorld(), { inGameplay: <Seed /> });
    await screen.findByPlaceholderText(/Type your action/);
    const endpoint = stubEndpoint(new Set(['digest']));
    act(() => seedHistory(storedTurn({ summary: 'You rang the bell once.' })));

    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'Memory' }));
    await user.click(await screen.findByRole('button', { name: 'Manage Memories' }));
    await user.click(await screen.findByRole('button', { name: 'Have the Story Write This Memory Again' }));
    await waitFor(() => expect(endpoint.calls.digest).toHaveLength(1));

    await view.unmountView();
    endpoint.release();
    // Every request has settled; the write would follow in the same chain, which a 0 ms flush drains.
    await act(async () => {
      await Promise.allSettled(transports);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(transports.length).toBeGreaterThan(0);
    expect(memoryEditsNow()).toEqual({});
  });
});
