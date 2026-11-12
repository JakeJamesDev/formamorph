import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn as playMoveTurn } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { migrateEntityRoutine } from '@/lib/version';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';
import type { Entity, GameLocation, Item, World } from '@/types';

/** The schema passes on a mounted game: an endpoint that refused a response schema gets each pass's text request. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const ENDPOINT = 'http://127.0.0.1:5190/v1/chat/completions';
const MODEL = 'm';

const lantern: Item = { id: 'lantern', name: 'Lantern', stackable: false, statEffects: [], traitEffects: [], equipRequires: [] };
// A character who can follow, standing on the harbor where the player starts.
const bram = migrateEntityRoutine({ id: 'bram', name: 'Bram', locations: ['harbor'], movement: 'follow' } as unknown as Entity);
const base = harborWorld({ entities: [bram] });
// A second place inside the harbor, so the location router and its entity pass have somewhere to move to.
const PIER = { id: 'pier', name: 'Pier', parentId: 'harbor' } as GameLocation;
const WORLD: World = { ...base, locations: [...base.locations, PIER], items: [lantern] } as World;

type Body ={ messages: { role: string; content: string }[]; response_format?: unknown };

/** Every request body, by the pass whose system prompt sent it. */
function stubEndpoint() {
  const sent = { clock: [] as Body[], inventory: [] as Body[], entity: [] as Body[] };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: MODEL }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as Body;
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('You measure how much time passes')) {
      sent.clock.push(body);
      return sseResponse(sseReply(body.response_format ? '{"lasts_until":"none","unit":"minutes","count":5}' : '5m'));
    }
    if (system.includes('inventory keeper')) {
      sent.inventory.push(body);
      return sseResponse(sseReply(body.response_format ? '{"operations":[]}' : 'NONE'));
    }
    if (system.includes('You track where the characters in an interactive story go')) {
      sent.entity.push(body);
      return sseResponse(sseReply(body.response_format ? '{}' : 'Bram: Stay'));
    }
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Go'));
    if (system.includes('stat tracker')) return sseResponse(sseReply(''));
    if (system.includes('You keep track of where the player character is')) return sseResponse(sseReply('NONE'));
    return sseResponse(sseReply('Bram nods at you across the quiet harbor.'));
  }));
  return sent;
}

/** The endpoint's stored capability: `false` records a refused schema, `undefined` knows nothing. */
function rememberSchema(structuredOutput: false | undefined) {
  localStorage.setItem('FORMAMORPH_reasoningSupport', JSON.stringify({
    [`${ENDPOINT}|${MODEL}`]: {
      ...UNKNOWN_REASONING_CAPABILITY,
      ...(structuredOutput === false && { structuredOutput: false, sources: { structuredOutput: 'observed' } }),
    },
  }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', ENDPOINT);
  localStorage.setItem('FORMAMORPH_modelName', MODEL);
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_concurrentTurnRequests', 'true');
  localStorage.setItem('FORMAMORPH_aiClock', 'true');
  localStorage.setItem('FORMAMORPH_locationAutoApply', 'true');
});

afterEach(() => vi.restoreAllMocks());

let play: ReturnType<typeof useGameplay>;
function Probe() {
  play = useGameplay();
  return null;
}

/** Plays a first turn, has Bram follow the player, then plays a second and returns what each schema pass sent. */
async function playTurns() {
  renderGameViewer(WORLD, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
  await playMoveTurn(() => play, 'I look around.');
  act(() => play.applyFollowerState({
    positions: { ...play.entityPositions, bram: 'harbor' },
    uniques: { ...play.uniqueStates, bram: { ...play.uniqueStates.bram, follow: { mode: 'following' as const } } },
    generics: play.genericStates,
  }));
  const sent = stubEndpoint();
  await playMoveTurn(() => play, 'I wave to Bram.');
  return sent;
}

// A phrase only each pass's text reply format carries.
const TEXT_FORMAT = { clock: 'm for minutes', inventory: 'split by " | "', entity: 'one row per character' };
/** Whether every request a pass sent asked for its text reply format. */
const askedForText = (pass: keyof typeof TEXT_FORMAT, bodies: Body[]) =>
  bodies.every((b) => b.messages.findLast((m) => m.role === 'user')?.content.includes(TEXT_FORMAT[pass]));

describe('the schema passes on an endpoint that refused a schema', () => {
  it('sends each pass its text request alone', async () => {
    rememberSchema(false);
    const sent = await playTurns();
    for (const pass of ['clock', 'inventory', 'entity'] as const) {
      expect([pass, sent[pass].length > 0]).toEqual([pass, true]);
      expect([pass, askedForText(pass, sent[pass]), sent[pass].some((b) => b.response_format)]).toEqual([pass, true, false]);
    }
  });

  it('sends each pass its schema request on an endpoint with no refusal on record', async () => {
    rememberSchema(undefined);
    const sent = await playTurns();
    for (const pass of ['clock', 'inventory', 'entity'] as const) {
      expect([pass, sent[pass].length > 0]).toEqual([pass, true]);
      expect([pass, askedForText(pass, sent[pass]), sent[pass].every((b) => b.response_format)]).toEqual([pass, false, true]);
    }
  });
});
