import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';

/** How many requests of each kind the endpoint has answered. */
export const calls = { narration: 0, choices: 0, stats: 0 };

/** Answers every turn call, including the separate choices and stats passes. `extra` answers other URLs first. */
export function stubDemoAIEndpoint(extra?: (url: string) => Response | null) {
  calls.narration = calls.choices = calls.stats = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const known = extra?.(String(input));
    if (known) return known;
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const system = (JSON.parse(init.body as string) as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === 'system')?.content ?? '';
    const kind = system.includes('player choice writer') ? 'choices' : system.includes('stat tracker') ? 'stats' : 'narration';
    calls[kind] += 1;
    return sseResponse(sseReply({
      narration: 'The ferry bell rings twice across the water.', choices: '1. Ring the bell\n2. Wait at the dock', stats: 'Vigor: -5',
    }[kind]));
  }));
}

export const regenerateChoices = () => screen.getByRole('button', { name: 'Regenerate Choices' });
export const regenerateStats = () => screen.getByRole('button', { name: 'Regenerate Stats' });

/** Runs `start`, waits for it to reach the endpoint, then for the re-roll buttons, which wake after the commit. */
export async function settles(kind: keyof typeof calls, start: () => void) {
  const before = calls[kind];
  start();
  await waitFor(() => expect(calls[kind]).toBeGreaterThan(before));
  await waitFor(() => {
    expect(regenerateChoices()).toBeEnabled();
    expect(regenerateStats()).toBeEnabled();
  });
}

export async function playTurn(action: string) {
  const box = await screen.findByPlaceholderText(/Type your action/);
  fireEvent.change(box, { target: { value: action } });
  await settles('narration', () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
}
