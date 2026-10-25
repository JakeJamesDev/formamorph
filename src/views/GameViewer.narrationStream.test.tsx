import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import type { ChatMessage } from '@/types';

/** The partial assistant message a streamed narration persists, seen through the history it writes. */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
// Pinned here so a developer's `.env.local` endpoint cannot hide the gate.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

/** Every history the game view rendered, in order. */
let histories: ChatMessage[][];
/** Renders a marker queued behind every update already made, so the history those updates left is recorded. */
let markRendered = 0;
let mark: (n: number) => void = () => {};
function HistoryProbe() {
  const { fullMessageHistory } = useGameplay();
  const [marker, setMarker] = useState(0);
  mark = setMarker;
  markRendered = marker;
  if (histories.at(-1) !== fullMessageHistory) histories.push(fullMessageHistory);
  return null;
}
let marks = 0;
const renderBehind = async () => {
  const n = ++marks;
  mark(n);
  await waitFor(() => expect(markRendered).toBe(n));
};

const narrationOf = (message: ChatMessage) => (JSON.parse(message.content) as { narration: string }).narration;
const latest = () => histories.at(-1) ?? [];

const sse = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
const DONE = 'data: [DONE]\n\n';

/**
 * Answers the narration request with a stream the test writes to, and every later request at once with
 * a plain sentence. The narration request is the first chat call of an opening turn with no planner.
 */
function stubModel() {
  let narration: ReadableStreamDefaultController<Uint8Array> | null = null;
  // With no buffer, the stream is pulled only when the reader asks for the next chunk.
  let pulls = 0;
  const encoder = new TextEncoder();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    const isChat = init?.method === 'POST' && typeof init.body === 'string' && init.body.includes('"messages"');
    if (!isChat) return new Response(JSON.stringify({ data: [] }), { headers: { 'Content-Type': 'application/json' } });
    const isNarration = (init.body as string).includes('You are the narrator stage');
    if (!isNarration) return new Response(sse('A quiet answer.') + DONE, { headers: { 'Content-Type': 'text/event-stream' } });
    const body = new ReadableStream<Uint8Array>(
      { start(controller) { narration = controller; }, pull() { pulls += 1; } },
      { highWaterMark: 0 },
    );
    init.signal?.addEventListener('abort', () => narration?.error(new DOMException('Aborted', 'AbortError')));
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  }));
  /** Sends one token and waits until the reader handled it, asked for the next, and its history rendered. */
  const send = async (content: string) => {
    const asked = pulls;
    narration!.enqueue(encoder.encode(sse(content)));
    await waitFor(() => expect(pulls).toBeGreaterThan(asked));
    await renderBehind();
  };
  return {
    opened: () => narration !== null,
    send,
    end: () => { narration!.enqueue(encoder.encode(DONE)); narration!.close(); },
  };
}

async function startOpeningTurn() {
  renderGameViewer(harborWorld(), { inGameplay: <HistoryProbe /> });
  fireEvent.click(await screen.findByRole('button', { name: 'Keep Playing' }));
  const model = stubModel();
  const box = await screen.findByPlaceholderText(/Type your action/);
  fireEvent.change(box, { target: { value: 'Look around' } });
  fireEvent.keyDown(box, { key: 'Enter' });
  await waitFor(() => expect(model.opened()).toBe(true));
  return model;
}

beforeEach(() => {
  localStorage.clear();
  histories = [];
});

describe('the streamed narration in history', () => {
  it('adds the partial message once on first text and refreshes it per sentence, not per token', async () => {
    const model = await startOpeningTurn();

    await model.send('The door');
    expect(latest().map((m) => m.role)).toEqual(['user', 'assistant']);
    for (const token of [' creaks.', ' Wind', ' howls']) await model.send(token);
    // The second sentence is in history before the stream ends, so the end cannot fold into its render.
    await waitFor(() => expect(narrationOf(latest()[1])).toBe('The door creaks. Wind'));
    model.end();
    await waitFor(() => expect(narrationOf(latest()[1])).toBe('The door creaks. Wind howls'));

    // While streaming, the history only ever held the one turn pair.
    expect(histories.every((h) => h.length <= 2)).toBe(true);
    const streamed = histories
      .filter((h) => h.length === 2)
      .map((h) => narrationOf(h[1]))
      .filter((text, i, all) => text !== all[i - 1]);
    expect(streamed.slice(0, 2)).toEqual(['The door', 'The door creaks. Wind']);
    expect(streamed).not.toContain('The door creaks.');
  });

  it('leaves no lone user turn when Stop lands before any narration text', async () => {
    const model = await startOpeningTurn();
    // Reasoning only: nothing the player would read as narration.
    await model.send('<think>Plan the harbor scene');
    expect(latest().map((m) => m.role)).toEqual(['user']);

    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    await waitFor(() => expect(latest()).toEqual([]));
    expect(histories.some((h) => h.some((m) => m.role === 'assistant'))).toBe(false);
  });
});
