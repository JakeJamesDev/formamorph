import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { Entity, GameLocation, World } from '@/types';

/** Narrated moves in Auto mode on a mounted game: where the player ends the turn, and who the story pulls there. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

// A village with two rooms inside it: the hut and the well.
const VILLAGE = { id: 'village', name: 'Village', isStarting: true } as GameLocation;
const HUT = { id: 'hut', name: 'Hut', parentId: 'village' } as GameLocation;
const WELL = { id: 'well', name: 'Well', parentId: 'village' } as GameLocation;
const character = (id: string, name: string, movement: Entity['movement'], locations: string[]): Entity =>
  ({ id, name, movement, locations } as unknown as Entity);

const worldWith = (over: Partial<World> = {}): World => ({
  ...harborWorld({
    entities: [
      // Free: no Movement set.
      character('asha', 'Asha', undefined, ['hut']),
      character('bram', 'Bram', 'follow', ['village']),
      character('maela', 'Maela', 'follow', ['village']),
    ],
  }),
  locations: [VILLAGE, HUT, WELL],
  ...over,
} as unknown as World);

let play: ReturnType<typeof useGameplay>;
function Probe() {
  play = useGameplay();
  return null;
}

/** The scripted endpoint: each request kind answers from `replies`, and everything else with the narration. */
function stubEndpoint(narration: string, replies: { router?: string; narrated?: string; entities?: Record<string, string> }) {
  const sent: string[] = [];
  // The choices request's system prompt: a pass after the narration, rendered at the place the turn ends.
  const choices: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = body.messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('You are the location router')) {
      sent.push('router');
      return sseResponse(sseReply(replies.router ?? 'NONE'));
    }
    if (system.includes('You keep track of where the player character is')) {
      sent.push('narrated');
      return sseResponse(sseReply(replies.narrated ?? 'Village'));
    }
    const mover = /You track where one character goes in an interactive story: (\w+)/.exec(system)?.[1];
    if (mover) return sseResponse(sseReply(replies.entities?.[mover] ?? 'Stay'));
    if (system.includes('player choice writer')) choices.push(system);
    return sseResponse(sseReply(narration));
  }));
  return { sent, choices };
}

/** The entities a prompt lists in its "Entities in Reachable Locations" section. */
const reachableIn = (system: string) => /## Entities in Reachable Locations([\s\S]*?)(?=\n\n[^-\n])/.exec(system)?.[1] ?? '';

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
  localStorage.setItem('FORMAMORPH_locationAutoApply', 'true');
});

/** Sends one action and waits for its turn to close. */
async function playTurn(action: string) {
  const turns = play.fullMessageHistory.length;
  fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: action } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(play.fullMessageHistory.length).toBe(turns + 2));
  await waitFor(() => expect(screen.getByPlaceholderText(/Type your action/)).toBeEnabled());
}

/** Where the game holds a character: its own position, else the place a pull anchored it at. */
const whereIs = (id: string) =>
  play.entityPositions[id] ?? play.discoveredEntities.find((d) => d.entity.id === id)?.locationId;

describe('a narrated move in Auto mode', () => {
  it('moves the player on the opening, before the pull: a character in the room the player is carried into stays there', async () => {
    renderGameViewer(worldWith(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    const endpoint = stubEndpoint('Strong arms carry you up into the hut, where Asha waits by the fire.', { narrated: 'Hut' });

    await playTurn('Begin.');

    expect(endpoint.sent).toEqual(['narrated']);
    await waitFor(() => expect(play.currentLocation?.id).toBe('hut'));
    // Judged at the village, the child pull would have brought Asha down out of her own hut.
    // She stays at the place she is listed in: nothing anchors her anywhere.
    expect(whereIs('asha')).toBeUndefined();
  });

  it('leaves a pulled character at the place a script moved the player to after the narration', async () => {
    const world = worldWith({ scripts: [{ id: 'go', timing: 'after', code: 'if (turn.narration.includes("well")) location.move("Well");' }] } as Partial<World>);
    renderGameViewer(world, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint('You walk to the edge of the well as Asha watches from the hut.', { narrated: 'Village' });

    await playTurn('Begin.');

    await waitFor(() => expect(play.currentLocation?.id).toBe('well'));
    expect(whereIs('asha')).toBe('well');
  });

  it('brings a follower along and leaves the one told to stay', async () => {
    renderGameViewer(worldWith(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint('The square is quiet.', { narrated: 'Village' });
    await playTurn('Begin.');
    act(() => play.applyFollowerState({ followers: ['bram', 'maela'], positions: { bram: 'village', maela: 'village' } }));

    const endpoint = stubEndpoint('Bram hoists you onto his shoulder and climbs into the hut.', {
      router: 'NONE', narrated: 'Hut', entities: { Bram: 'Keep following', Maela: 'Stay here' },
    });
    await playTurn('Maela, wait for us here.');

    expect(endpoint.sent).toEqual(['router', 'narrated']);
    await waitFor(() => expect(play.currentLocation?.id).toBe('hut'));
    expect(play.entityPositions.bram).toBe('hut');
    expect(play.entityFollowers).toEqual(['bram']);
    expect(play.entityPositions.maela).toBe('village');
    // The passes after the narration already read the hut, with Bram beside the player and Maela left behind.
    const choices = endpoint.choices.at(-1) ?? '';
    expect(choices).toContain('## Current Location\n- **name:** Hut');
    const elsewhere = reachableIn(choices);
    expect(elsewhere).toContain('Maela');
    expect(elsewhere).not.toContain('Bram');
  });

  it('leaves the player and a follower where they stand when the story went Elsewhere', async () => {
    renderGameViewer(worldWith(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint('The square is quiet.', { narrated: 'Village' });
    await playTurn('Begin.');
    act(() => play.applyFollowerState({ followers: ['bram'], positions: { bram: 'village' } }));

    const endpoint = stubEndpoint('You walk past the hut and on over the far hills to a town of slate roofs.', {
      router: 'NONE', narrated: 'Elsewhere, past the Hut', entities: { Bram: 'Keep following' },
    });
    await playTurn('I walk over the hills to the next town.');

    expect(endpoint.sent).toEqual(['router', 'narrated']);
    expect(play.currentLocation?.id).toBe('village');
    expect(play.entityPositions.bram).toBe('village');
    expect(endpoint.choices.at(-1) ?? '').toContain('## Current Location\n- **name:** Village');
  });

  it('never runs after the router moved the player', async () => {
    renderGameViewer(worldWith(), { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint('The square is quiet.', { narrated: 'Village' });
    await playTurn('Begin.');

    const endpoint = stubEndpoint('You walk to the well.', { router: 'Well', narrated: 'Hut' });
    await playTurn('I walk to the well.');

    expect(endpoint.sent).toEqual(['router']);
    await waitFor(() => expect(play.currentLocation?.id).toBe('well'));
  });
});
