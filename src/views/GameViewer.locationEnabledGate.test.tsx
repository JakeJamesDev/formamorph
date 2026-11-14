import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePresence } from '@/lib/usePresence';
import type { Presence } from '@/lib/presence';
import type { Entity, GameLocation, PlayerStat, World } from '@/types';

/**
 * A location's Enabled gate in play, through the real resolver: a gate on the global Veil stat takes Oldtown and
 * the Lane inside it out of the world (Q2). Pell, who lives only in the Lane, is stranded: offstage, his stats
 * still running (Q27, Q50). A new game never starts in an off starting location (Q12, Q51).
 */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, name: string, over: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over });
const veilUp = [{ all: [{ kind: 'stat' as const, id: 'veil', operator: '>=' as const, value: 1, unit: 'raw' as const }] }];

const HARBOR: GameLocation = { id: 'harbor', name: 'Harbor', isStarting: true };
const OLDTOWN: GameLocation = { id: 'oldtown', name: 'Oldtown', enabledWhen: veilUp };
const LANE: GameLocation = { id: 'lane', name: 'Lanternlane', parentId: 'oldtown' };
const mira: Entity = { id: 'mira', name: 'Mira', kind: 'unique', knownIn: ['harbor'],
  starts: [{ id: 'home', place: 'harbor', weight: 1, schedule: [] }] };
const pell: Entity = {
  id: 'pell', name: 'Pell', kind: 'unique', knownIn: ['harbor', 'lane'],
  starts: [{ id: 'stall', place: 'lane', weight: 1, schedule: [] }],
  stats: [
    stat('count', 'Count', { scripts: [{ id: 'tick', timing: 'after', code: 'self.value += 1;' }] }),
    stat('energy', 'Energy', { regen: 5 }),
  ] as Entity['stats'],
};
const world = (veil: number, locations: GameLocation[] = [HARBOR, OLDTOWN, LANE]): World => ({
  ...harborWorld({
    stats: [stat('veil', 'Veil', { value: veil }), stat('so', 'ProbeA'), stat('sl', 'ProbeB'), stat('sp', 'ProbeC')],
    entities: [mira, pell],
  }),
  locations,
  connections: [{ id: 'quay', a: 'harbor', b: 'lane', aToB: {}, bToA: {} }],
  scripts: [{
    id: 'who', timing: 'after',
    code: 'if (locations.Oldtown.name === "Oldtown") stats.ProbeA.value = 1; if (locations.Lanternlane.name === "Lanternlane") stats.ProbeB.value = 1; if (entities.Pell.name === "Pell") stats.ProbeC.value = 1;',
  }],
} as World);

let live: ReturnType<typeof useGameplay> | null = null;
let presence: Presence | null = null;
const Probe = () => { live = useGameplay(); presence = usePresence(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const inPresence = (id: string) => {
  if (!presence) throw new Error('no presence yet');
  const { byId, lookAround, inScene, met, known } = presence;
  return byId.has(id) || [...lookAround, ...inScene, ...met, ...known].some((p) => p.entity.id === id);
};
const global = (name: string) => gameplay().globalStats.find((s) => s.name === name)?.value;
const pellStat = (id: string) => gameplay().entityStats.pell?.find((s) => s.id === id)?.value;

async function start(on: World) {
  renderGameViewer(on, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().currentLocation).not.toBeNull());
}
/** Every message one turn sent the AI, as one text. */
async function turnText() {
  const sent: string[] = [];
  stubMoveEndpoint('The tide turns.', {});
  const answer = vi.mocked(fetch);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.body) sent.push(init.body as string);
    return answer(url, init);
  }));
  await playTurn(gameplay, 'Look around');
  return sent.join('\n');
}

beforeEach(async () => {
  await resetMoveTurnStorage();
  live = null;
  presence = null;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('a disabled parent location', () => {
  it('reaches no reader with its child, and strands the one who lives there with his stats running', async () => {
    await start(world(0));
    const energy = pellStat('energy') ?? 0;
    const text = await turnText();
    expect(text).toContain('Harbor');
    expect(text).toContain('Mira');
    for (const hidden of ['Oldtown', 'Lanternlane', 'Pell']) expect(text).not.toContain(hidden);
    expect(inPresence('pell')).toBe(false);
    expect(global('ProbeA')).toBe(0);
    expect(global('ProbeB')).toBe(0);
    // Stranded, not off: the script globals keep him and his own script and regen run.
    expect(global('ProbeC')).toBe(1);
    expect(pellStat('count')).toBe(1);
    expect(pellStat('energy')).toBeGreaterThan(energy);
  });

  it('reaches every reader while its gate holds', async () => {
    await start(world(1));
    const text = await turnText();
    for (const shown of ['Oldtown', 'Lanternlane', 'Pell']) expect(text).toContain(shown);
    expect(inPresence('pell')).toBe(true);
    expect(global('ProbeA')).toBe(1);
    expect(global('ProbeB')).toBe(1);
  });
});

describe('a position in a place that turns off (Q52)', () => {
  const setVeil = (value: number) => act(() => {
    gameplay().setGlobalStats(gameplay().globalStats.map((s) => (s.id === 'veil' ? { ...s, value } : s)));
  });

  it('drops at the next turn, stays dropped across a save and load, and the routine places him again', async () => {
    await start(world(1));
    await waitFor(() => expect(gameplay().entityPositions.pell).toBe('lane'));
    await setVeil(0);
    await turnText();
    expect(gameplay().entityPositions.pell).toBeUndefined();

    await act(async () => { await gameplay().saveGame('slot', 'Sedge Landing', 'w1', 'save-lane-off'); });
    cleanup();
    live = null;
    renderGameViewer(world(1), { inGameplay: <Probe />, initialSaveId: 'save-lane-off' });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(gameplay().entityPositions).toHaveProperty('mira'));
    expect(gameplay().entityPositions.pell).toBeUndefined();

    await setVeil(1);
    await turnText();
    expect(gameplay().entityPositions.pell).toBe('lane');
  });
});

describe('the new-game start pick', () => {
  // Oldtown is the only starting location; with it off the game opens at the first on location in tree order.
  const oldtownStart = (veil: number) => world(veil, [{ ...OLDTOWN, isStarting: true }, LANE, { ...HARBOR, isStarting: false }]);

  it('never starts in a starting location whose gate fails', async () => {
    await start(oldtownStart(0));
    expect(gameplay().currentLocation?.id).toBe('harbor');
  });

  it('starts there while its gate holds', async () => {
    await start(oldtownStart(1));
    expect(gameplay().currentLocation?.id).toBe('oldtown');
  });
});
