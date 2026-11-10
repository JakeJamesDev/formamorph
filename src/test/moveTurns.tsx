/** Shared pieces of the mounted-game move tests: a scripted endpoint, the storage reset, and the play-one-turn step. */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import type { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';

type Gameplay = ReturnType<typeof useGameplay>;

/** An entity's reply: the text itself, or a pick from the lines its request offered. */
export type EntityReplyScript = string | ((offered: string[]) => string);

export interface MoveReplies {
  router?: string;
  narrated?: string;
  entities?: Record<string, EntityReplyScript>;
}

/** The request body as the stub reads it. */
export interface SentBody {
  messages: { role: string; content: string }[];
  [key: string]: unknown;
}

/**
 * The scripted endpoint: each request kind answers from `replies`, and everything else with the narration.
 * `sent` lists the location requests in order; `after` keeps the latest system prompt of each pass that runs
 * after the narration; `entityRequests` lists every entity location request body; `entityBodies` keeps the latest
 * one that asked about each character.
 */
export function stubMoveEndpoint(narration: string, replies: MoveReplies, narratedFallback = 'Barn') {
  const sent: string[] = [];
  const after = { choices: '', stats: '', inventory: '' };
  const entityBodies: Record<string, SentBody> = {};
  const entityRequests: SentBody[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as SentBody;
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('You are the location router')) {
      sent.push('router');
      return sseResponse(sseReply(replies.router ?? 'NONE'));
    }
    if (system.includes('You keep track of where the player character is')) {
      sent.push('narrated');
      return sseResponse(sseReply(replies.narrated ?? narratedFallback));
    }
    if (system.includes('You track where the characters in an interactive story go')) {
      entityRequests.push(body);
      const user = body.messages.findLast((m) => m.role === 'user')?.content ?? '';
      // One block per character: "## Name", its state, then its offered lines.
      const answer = Object.fromEntries(user.split('\n## ').slice(1).map((block) => {
        const [mover, ...lines] = block.split('\n');
        entityBodies[mover] = body;
        const script = replies.entities?.[mover] ?? 'Stay';
        const offered = lines.flatMap((line) => (line.startsWith('- ') ? [line.slice(2)] : []));
        return [mover, typeof script === 'function' ? script(offered) : script];
      }));
      return sseResponse(sseReply(JSON.stringify(answer)));
    }
    if (system.includes('player choice writer')) {
      after.choices = system;
      return sseResponse(sseReply('1. Look around\n2. Wait'));
    }
    if (system.includes('stat tracker')) {
      after.stats = system;
      return sseResponse(sseReply(''));
    }
    if (system.includes('inventory keeper')) {
      after.inventory = system;
      return sseResponse(sseReply(JSON.stringify({ operations: [] })));
    }
    return sseResponse(sseReply(narration));
  }));
  return { sent, after, entityBodies, entityRequests };
}

/** Clears saves and settings, and points the game at the scripted endpoint in Auto mode. */
export async function resetMoveTurnStorage() {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_locationAutoApply', 'true');
}

/** Sends one action and waits for its turn to close. */
export async function playTurn(play: () => Gameplay, action: string) {
  const turns = play().fullMessageHistory.length;
  fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(play().fullMessageHistory.length).toBe(turns + 2));
  await waitFor(() => expect(screen.getByPlaceholderText(/Type your action/)).toBeEnabled());
  // The passes after the narration can still run once the box enables; the turn ends when generation stops.
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop generating' })).toBeNull());
}
