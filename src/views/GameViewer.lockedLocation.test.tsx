import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import { oneRoutine } from '@/test/routines';
import type { Entity, GameLocation, World, WorldOption } from '@/types';

/**
 * A location's Lock gate in play, through the real resolver: Oldtown and the Lane inside it are locked until the
 * Gate Open Option is on. Every player travel surface asks the travel gate and refuses a move in (Q3, Q53); a
 * script's `location.move` does not. The AI still sees the locked places and who is inside (Q28).
 */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('@/components/game/LocationMap', () => ({ default: () => null }));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const GATE: WorldOption = { id: 'gate', name: 'Gate Open', type: 'boolean', shownToPlayer: true, midGame: false, default: false };
const gateOpen = [{ all: [{ kind: 'option' as const, id: 'gate' }] }];

const HARBOR: GameLocation = { id: 'harbor', name: 'Harbor', isStarting: true };
const OLDTOWN: GameLocation = { id: 'oldtown', name: 'Oldtown', unlockedWhen: gateOpen, lockedText: 'The gate is barred' };
const LANE: GameLocation = { id: 'lane', name: 'Lanternlane', parentId: 'oldtown' };
const pell: Entity = {
  id: 'pell', name: 'Pell', kind: 'unique', knownIn: ['harbor', 'lane'],
  routines: oneRoutine([{ id: 'stall', place: 'lane', weight: 1, schedule: [] }]),
};
const world = (
  { open = false, scripts = [] as { id: string; timing: string; code: string }[], locations = [HARBOR, OLDTOWN, LANE] } = {},
): World => ({
  ...harborWorld({ entities: [pell] }),
  locations,
  connections: [{ id: 'quay', a: 'harbor', b: 'lane', aToB: {}, bToA: {} }],
  options: [{ ...GATE, default: open }],
  scripts,
} as World);

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const at = () => gameplay().currentLocation?.id;

async function start(on: World) {
  renderGameViewer(on, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(at()).not.toBeUndefined());
}

/** Starts the game and plays its opening turn, after which the router runs. */
async function opened(on: World) {
  await start(on);
  stubMoveEndpoint('You stand on the harbor.', { narrated: 'Harbor' }, 'Harbor');
  await playTurn(gameplay, 'Begin.');
  expect(at()).toBe('harbor');
}

/** Opens Change Location on the List and clicks the row named `name`. */
async function clickOnList(name: string) {
  await act(async () => { gameplay().setActiveTab('location'); });
  fireEvent.click(await screen.findByRole('button', { name: /Current Location:/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Change Location' });
  fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^(Locked)?\\s*${name}`) }));
  return dialog;
}

beforeEach(async () => {
  await resetMoveTurnStorage();
  live = null;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('a locked location on the List', () => {
  it('shows the Locked text and leaves the player where they were', async () => {
    await start(world());
    const dialog = await clickOnList('Lanternlane');
    expect(within(dialog).getAllByText('The gate is barred')).toHaveLength(2);
    expect(at()).toBe('harbor');
  });

  it('travels there once unlocked', async () => {
    await start(world({ open: true }));
    await clickOnList('Lanternlane');
    await waitFor(() => expect(at()).toBe('lane'));
  });
});

describe('the AI router and the narrated move', () => {
  it('never move the player into a locked place', async () => {
    await opened(world());
    stubMoveEndpoint('You walk the quay into the lane.', { router: 'Lanternlane', narrated: 'Lanternlane' }, 'Harbor');
    await playTurn(gameplay, 'Go to the lane');
    expect(at()).toBe('harbor');
  });

  it('moves them there while it is open', async () => {
    await opened(world({ open: true }));
    stubMoveEndpoint('You walk the quay into the lane.', { router: 'Lanternlane', narrated: 'Lanternlane' }, 'Harbor');
    await playTurn(gameplay, 'Go to the lane');
    await waitFor(() => expect(at()).toBe('lane'));
  });
});

describe('the Move-to chip', () => {
  it('refuses a place that locked after the offer (Q56)', async () => {
    localStorage.setItem('FORMAMORPH_locationAutoApply', 'false');
    await opened(world({ open: true }));
    stubMoveEndpoint('You walk the quay into the lane.', { router: 'Lanternlane', narrated: 'Lanternlane' }, 'Harbor');
    await playTurn(gameplay, 'Go to the lane');
    const move = await screen.findByRole('button', { name: 'Go' });
    await act(async () => { gameplay().setWorldOptionValues({ gate: false }); });
    fireEvent.click(move);
    expect(at()).toBe('harbor');
    expect(screen.queryByRole('button', { name: 'Go' })).toBeNull();
  });

  it('moves the player while the place stays open', async () => {
    localStorage.setItem('FORMAMORPH_locationAutoApply', 'false');
    await opened(world({ open: true }));
    stubMoveEndpoint('You walk the quay into the lane.', { router: 'Lanternlane', narrated: 'Lanternlane' }, 'Harbor');
    await playTurn(gameplay, 'Go to the lane');
    fireEvent.click(await screen.findByRole('button', { name: 'Go' }));
    expect(at()).toBe('lane');
  });
});

describe('scripts and the lock', () => {
  it('lets a script\'s location.move carry the player in (Q3)', async () => {
    await start(world({ scripts: [{ id: 'push', timing: 'after', code: 'location.move("Lanternlane");' }] }));
    stubMoveEndpoint('The guard waves you through.', {});
    await playTurn(gameplay, 'Wait');
    expect(at()).toBe('lane');
  });

  it('unlocks the place once a script writes the Option the gate reads (Q4)', async () => {
    await start(world({ scripts: [{ id: 'unbar', timing: 'after', code: 'options["Gate Open"] = true;' }] }));
    stubMoveEndpoint('The bar lifts.', {});
    await playTurn(gameplay, 'Wait');
    await clickOnList('Lanternlane');
    await waitFor(() => expect(at()).toBe('lane'));
  });
});

describe('the AI context of a locked place (Q28)', () => {
  // The default prompts list the place itself only in the router's list; lockedPlaces.test.ts covers the Nearby chips.
  it('still tells the narrator about who lives inside', async () => {
    await start(world());
    const sent: string[] = [];
    stubMoveEndpoint('The tide turns.', {});
    const answer = vi.mocked(fetch);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.body) sent.push(init.body as string);
      return answer(url, init);
    }));
    await playTurn(gameplay, 'Look around');
    const text = sent.join('\n');
    expect(text).toContain('- **Pell**');
  });
});

describe('the new-game start pick (Q12, Q55)', () => {
  const oldtownStart = (open: boolean) =>
    world({ open, locations: [{ ...OLDTOWN, isStarting: true }, LANE, { ...HARBOR, isStarting: false }] });

  it('never starts in a locked starting location', async () => {
    await start(oldtownStart(false));
    expect(at()).toBe('harbor');
  });

  it('starts there once it is unlocked', async () => {
    await start(oldtownStart(true));
    expect(at()).toBe('oldtown');
  });
});
