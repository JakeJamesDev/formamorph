import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { migrateEntityRoutine } from '@/lib/version';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn as playOneTurn, resetMoveTurnStorage, stubMoveEndpoint as stubEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import type { Connection, Entity, GameLocation, Item, PlayerStat, World } from '@/types';

/** Moves of more than one step on a mounted game: where the player ends the turn, who comes along, and what the
 *  passes after the move read. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

// farm > { barn, yard } ; town > store > backroom ; a lane joins the yard to the town both ways.
// From the barn: yard 1 move, town 2, store 3, backroom 4.
const FARM = { id: 'farm', name: 'Farm' } as GameLocation;
const BARN = { id: 'barn', name: 'Barn', parentId: 'farm', isStarting: true } as GameLocation;
const YARD = { id: 'yard', name: 'Yard', parentId: 'farm' } as GameLocation;
const TOWN = { id: 'town', name: 'Town' } as GameLocation;
const STORE = { id: 'store', name: 'Store', parentId: 'town' } as GameLocation;
const BACKROOM = { id: 'backroom', name: 'Backroom', parentId: 'store' } as GameLocation;
const LANE: Connection = { id: 'lane', a: 'yard', b: 'town', aToB: { hint: 'down the lane' }, bToA: {} };

// Partial fixtures: the move path reads only these fields.
// A shipped entity as a world file stores it, through the load migration.
const character = (id: string, name: string, movement: 'follow' | 'between' | undefined, locations: string[], presence?: 'random'): Entity =>
  migrateEntityRoutine({ id, name, locations, ...(movement && { movement }), ...(presence && { presence }) } as unknown as Entity);
/** The live book with `ids` following the player and `positions` laid over. */
const following = (ids: string[], positions: Record<string, string>) => ({
  positions: { ...play.entityPositions, ...positions },
  uniques: { ...play.uniqueStates, ...Object.fromEntries(ids.map((id) => [id, { ...play.uniqueStates[id], follow: { mode: 'following' as const } }])) },
  generics: play.genericStates,
});
const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
// Lies in the store; its stat effect puts its name in the stat request where it is present.
const ledger: Item = {
  id: 'ledger', name: 'Shop Ledger', stackable: false, traitEffects: [], equipRequires: [],
  statEffects: [{ id: 'r1', statId: 'vigor', amount: 1, timing: 'owned', facet: 'value', op: 'add' }],
};

// Partial world: harborWorld supplies the rest, and the item and placement fields are the ones the passes read.
const worldWith = (over: Partial<World> = {}): World => ({
  ...harborWorld({
    stats: [vigor],
    entities: [
      character('ines', 'Ines', undefined, ['store']),
      character('bram', 'Bram', 'follow', ['barn']),
      character('maela', 'Maela', 'follow', ['barn']),
      // Moves Between the barn and the town, never the store.
      character('wren', 'Wren', 'between', ['barn', 'town'], 'random'),
    ],
  }),
  locations: [FARM, BARN, YARD, TOWN, STORE, BACKROOM],
  connections: [LANE],
  items: [ledger],
  placements: [{ id: 'p1', where: { kind: 'location', id: 'store' }, quantity: 1, source: { kind: 'item', itemId: 'ledger' } }],
  ...over,
} as unknown as World);

let play: ReturnType<typeof useGameplay>;
function Probe() {
  play = useGameplay();
  return null;
}

beforeEach(resetMoveTurnStorage);

const playTurn = (action: string) => playOneTurn(() => play, action);

/** Mounts the world and plays the opening turn in the barn. */
async function openInBarn(world = worldWith()) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint('The barn smells of hay.', { narrated: 'Barn' });
  await playTurn('Begin.');
  expect(play.currentLocation?.id).toBe('barn');
}

const CURRENT_STORE = '## Current Location\n- **name:** Store';

describe('a move of more than one step in Auto mode', () => {
  it('moves the player 3 moves on a router answer, and the passes after it read the store', async () => {
    await openInBarn();
    const endpoint = stubEndpoint('You walk down the lane into town and step into the store, where Ines looks up.', { router: 'Store' });

    await playTurn('I walk down the lane to town and step into the store.');

    expect(endpoint.sent).toEqual(['router']);
    await waitFor(() => expect(play.currentLocation?.id).toBe('store'));
    expect(endpoint.after.choices).toContain(CURRENT_STORE);
    expect(endpoint.after.stats).toContain('Shop Ledger');
    expect(endpoint.after.inventory).toContain('Shop Ledger');
  });

  it('moves the player to a far place a Narrated Move answer names', async () => {
    await openInBarn();
    const endpoint = stubEndpoint('A cart carries you down the lane and drops you at the store door; you go in.', { router: 'NONE', narrated: 'Store' });

    await playTurn('I climb onto the cart.');

    expect(endpoint.sent).toEqual(['router', 'narrated']);
    await waitFor(() => expect(play.currentLocation?.id).toBe('store'));
    expect(endpoint.after.choices).toContain(CURRENT_STORE);
    expect(endpoint.after.stats).toContain('Shop Ledger');
    expect(endpoint.after.inventory).toContain('Shop Ledger');
  });

  it('moves nobody on a router reply that names a far place inside other words, and still moves one step to the yard', async () => {
    await openInBarn();
    stubEndpoint('You think about the store in town.', { router: 'I would go to the Store.', narrated: 'Barn' });

    await playTurn('I think about the store.');
    expect(play.currentLocation?.id).toBe('barn');

    stubEndpoint('You step out into the yard.', { router: 'I would go to the Yard.' });
    await playTurn('I step out into the yard.');
    await waitFor(() => expect(play.currentLocation?.id).toBe('yard'));
  });

  it('leaves the player where they stand on a place past 3 moves', async () => {
    await openInBarn();
    stubEndpoint('You walk to town, through the store and into its back room.', { router: 'Backroom', narrated: 'Backroom' });

    await playTurn('I go to the back room of the store.');

    expect(play.currentLocation?.id).toBe('barn');
  });

  it('moves nobody on a name two places share at the same distance', async () => {
    const shed1 = { id: 'shed1', name: 'Shed', parentId: 'farm' } as GameLocation;
    const shed2 = { id: 'shed2', name: 'Shed', parentId: 'farm' } as GameLocation;
    await openInBarn(worldWith({ locations: [FARM, BARN, YARD, TOWN, STORE, BACKROOM, shed1, shed2] }));
    stubEndpoint('You step into the shed.', { router: 'Shed', narrated: 'Shed' });

    await playTurn('I go into the shed.');

    expect(play.currentLocation?.id).toBe('barn');
  });

  it('brings a follower to the final place, leaves the one told to stay, and leaves a Moves Between character the store is not hers', async () => {
    await openInBarn();
    act(() => play.applyFollowerState(following(['bram', 'maela'], { bram: 'barn', maela: 'barn', wren: 'barn' })));
    stubEndpoint('You walk down the lane into town and into the store.', {
      router: 'Store',
      entities: { Bram: 'Keep following', Maela: (offered) => offered.find((line) => line.startsWith('Wait here until')) ?? 'Stay', Wren: 'Come along' },
    });

    await playTurn('Maela, wait here. Wren, come with me to the store.');

    await waitFor(() => expect(play.currentLocation?.id).toBe('store'));
    expect(play.entityPositions.bram).toBe('store');
    expect(play.entityFollowers).toEqual(['bram']);
    expect(play.entityPositions.maela).toBe('barn');
    // Wren owns the town on the way, not the store, so she stays.
    expect(play.entityPositions.wren).toBe('barn');
  });
});

describe('a move of more than one step in Suggest mode', () => {
  it('offers the final place, and Go moves the player there with the follower', async () => {
    localStorage.setItem('FORMAMORPH_locationAutoApply', 'false');
    await openInBarn();
    act(() => play.applyFollowerState(following(['bram'], { bram: 'barn' })));
    stubEndpoint('You walk down the lane into town and step into the store.', { narrated: 'Store', entities: { Bram: 'Keep following' } });

    await playTurn('I walk to the store in town.');

    expect(play.currentLocation?.id).toBe('barn');
    const offer = await screen.findByText(/Move to/);
    expect(offer.textContent).toContain('Store');
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(play.currentLocation?.id).toBe('store'));
    expect(play.entityPositions.bram).toBe('store');
  });
});

describe('a Far link', () => {
  it('still carries the player and a follower across it', async () => {
    await openInBarn(worldWith({ connections: [{ ...LANE, distance: 'far' }] }));
    act(() => play.applyFollowerState(following(['bram'], { bram: 'barn' })));
    stubEndpoint('You walk the long lane into town and step into the store.', { router: 'Store', entities: { Bram: 'Keep following' } });

    await playTurn('I walk the long lane to town and step into the store.');

    await waitFor(() => expect(play.currentLocation?.id).toBe('store'));
    expect(play.entityPositions.bram).toBe('store');
  });
});
