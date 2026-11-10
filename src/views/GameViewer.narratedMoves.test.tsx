import { act, screen, waitFor } from '@testing-library/react';
import { migrateEntityRoutine } from '@/lib/version';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn as playOneTurn, resetMoveTurnStorage, stubMoveEndpoint, type MoveReplies } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
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
// A shipped entity as a world file stores it, through the load migration.
const character = (id: string, name: string, movement: 'follow' | 'between' | undefined, locations: string[], presence?: 'random'): Entity =>
  migrateEntityRoutine({ id, name, locations, ...(movement && { movement }), ...(presence && { presence }) } as unknown as Entity);
/** The live book with `ids` following the player and `positions` laid over. */
const following = (ids: string[], positions: Record<string, string>) => ({
  positions: { ...play.entityPositions, ...positions },
  individuals: { ...play.individualStates, ...Object.fromEntries(ids.map((id) => [id, { ...play.individualStates[id], follow: { mode: 'following' as const } }])) },
});

const worldWith = (over: Partial<World> = {}): World => ({
  ...harborWorld({
    entities: [
      // Can Follow, so her routine lets the story call her anywhere.
      character('asha', 'Asha', 'follow', ['hut']),
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

const stubEndpoint = (narration: string, replies: MoveReplies) => stubMoveEndpoint(narration, replies, 'Village');

/** The entities a prompt lists in its "Entities in Reachable Locations" section. */
const reachableIn = (system: string) => /## Entities in Reachable Locations([\s\S]*?)(?=\n\n[^-\n]|\s*$)/.exec(system)?.[1] ?? '';

beforeEach(resetMoveTurnStorage);

const playTurn = (action: string) => playOneTurn(() => play, action);

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
    expect(whereIs('asha')).toBe('hut');
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
    act(() => play.applyFollowerState(following(['bram', 'maela'], { bram: 'village', maela: 'village' })));

    const endpoint = stubEndpoint('Bram hoists you onto his shoulder and climbs into the hut.', {
      router: 'NONE', narrated: 'Hut',
      entities: { Bram: 'Keep following', Maela: (offered) => offered.find((line) => line.startsWith('Wait here until')) ?? 'Stay' },
    });
    await playTurn('Maela, wait for us here.');

    expect(endpoint.sent).toEqual(['router', 'narrated']);
    await waitFor(() => expect(play.currentLocation?.id).toBe('hut'));
    expect(play.entityPositions.bram).toBe('hut');
    expect(play.entityFollowers).toEqual(['bram']);
    expect(play.entityPositions.maela).toBe('village');
    expect(play.individualStates.maela.follow).toMatchObject({ mode: 'waiting' });
    // The request carried the time, the daypart, and its pinned samplers.
    const body = endpoint.entityBodies.Maela;
    expect(body.messages.at(-1)?.content).toMatch(/\nThe time is \d\d:\d\d, (night|dawn|morning|midday|afternoon|evening)\.\n/);
    expect(body).toMatchObject({ temperature: 0.15, repetition_penalty: 1 });
    expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'entity_moves' } });
    // One request asked about both characters.
    expect(endpoint.entityRequests).toHaveLength(1);
    expect(endpoint.entityBodies.Bram).toBe(body);
    // The passes after the narration already read the hut, with Bram beside the player and Maela left behind.
    const choices = endpoint.after.choices;
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
    act(() => play.applyFollowerState(following(['bram'], { bram: 'village' })));

    const endpoint = stubEndpoint('You walk past the hut and on over the far hills to a town of slate roofs.', {
      router: 'NONE', narrated: 'Elsewhere, past the Hut', entities: { Bram: 'Keep following' },
    });
    await playTurn('I walk over the hills to the next town.');

    expect(endpoint.sent).toEqual(['router', 'narrated']);
    expect(play.currentLocation?.id).toBe('village');
    expect(play.entityPositions.bram).toBe('village');
    expect(endpoint.after.choices).toContain('## Current Location\n- **name:** Village');
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
