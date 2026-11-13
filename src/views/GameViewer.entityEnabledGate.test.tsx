import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePresence } from '@/lib/usePresence';
import type { Presence } from '@/lib/presence';
import type { Entity, GameLocation, PlayerStat, World } from '@/types';

/**
 * An entity's Enabled gate in play, through the real resolver: a gate on the global Veil stat turns Ghost off
 * and back on. Off, it reaches no reader, its stats and scripts pause, and its place and engine state hold (Q9,
 * Q23, Q38).
 */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const HARBOR = { id: 'harbor', name: 'Harbor', isStarting: true } as GameLocation;
const MARKET = { id: 'market', name: 'Market' } as GameLocation;
const stat = (id: string, name: string, over: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over });
const veil = stat('veil', 'Veil', { value: 1 });
// Ghost walks the Harbor and the Market, an hour at each, while the Veil is up. Its Count climbs by script each
// turn and its Energy by regen.
const ghost: Entity = {
  id: 'ghost', name: 'Ghost', kind: 'unique', locations: ['harbor', 'market'], knownIn: ['harbor', 'market'],
  starts: [{ id: 'round', place: 'harbor', weight: 1, schedule: [{
    id: 'walk', time: 'allDay', action: { kind: 'patrol', stops: [{ place: 'harbor', idle: 60 }, { place: 'market', idle: 60 }] },
  }] }],
  stats: [
    stat('count', 'Count', { scripts: [{ id: 'tick', timing: 'after', code: 'self.value += 1;' }] }),
    stat('energy', 'Energy', { regen: 5 }),
  ] as Entity['stats'],
  enabledWhen: [{ all: [{ kind: 'stat', id: 'veil', operator: '>=', value: 1, unit: 'raw' }] }],
};
const mira: Entity = { id: 'mira', name: 'Mira', kind: 'unique', locations: ['harbor'], knownIn: ['harbor'],
  starts: [{ id: 'home', place: 'harbor', weight: 1, schedule: [] }] };
const world: World = {
  ...harborWorld({ stats: [veil], entities: [mira, ghost] }),
  locations: [HARBOR, MARKET],
  connections: [{ id: 'quay', a: 'harbor', b: 'market', aToB: {}, bToA: {} }],
};

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
const ghostStat = (id: string) => gameplay().entityStats.ghost?.find((s) => s.id === id)?.value;
const setVeil = (value: number) => act(() => {
  gameplay().setGlobalStats(gameplay().globalStats.map((s) => (s.id === 'veil' ? { ...s, value } : s)));
});

async function start(initialSaveId?: string) {
  renderGameViewer(world, { inGameplay: <Probe />, initialSaveId });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().currentLocation).not.toBeNull());
}
async function turn() {
  stubMoveEndpoint('The tide turns.', {});
  await playTurn(gameplay, 'Wait');
}

beforeEach(async () => {
  await resetMoveTurnStorage();
  live = null;
  presence = null;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the readers, through a real gate', () => {
  const sees = stat('sees', 'Witness');
  const readers = (veilUp: number): World => ({
    ...world,
    stats: [{ ...veil, value: veilUp }, sees],
    scripts: [{ id: 'who', timing: 'after', code: 'if (entities.Ghost.name === "Ghost") stats.Witness.value = 1;' }],
  } as World);
  /** Every message the turn sent the AI, as one text. */
  async function sentText(on: World) {
    renderGameViewer(on, { inGameplay: <Probe /> });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(gameplay().currentLocation).not.toBeNull());
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
  const seesGhost = () => gameplay().globalStats.find((s) => s.id === 'sees')?.value;

  it('see no entity whose gate fails: presence, the AI requests and the script globals', async () => {
    const text = await sentText(readers(0));
    expect(text).toContain('Mira');
    expect(text).not.toContain("Ghost");
    expect(inPresence('ghost')).toBe(false);
    expect(seesGhost()).toBe(0);
  });

  it('see it while its gate holds', async () => {
    const text = await sentText(readers(1));
    expect(text).toContain('Ghost');
    expect(inPresence('ghost')).toBe(true);
    expect(seesGhost()).toBe(1);
  });
});

describe('an entity whose Enabled gate fails', () => {
  it('pauses while off and resumes where it paused, across a save and load', async () => {
    await start();
    await waitFor(() => expect(gameplay().entityPositions).toHaveProperty('ghost'));
    // On: the script and the regen run, and the patrol moves it each hour.
    await turn();
    const count = ghostStat('count')!;
    const energy = ghostStat('energy')!;
    expect(count).toBeGreaterThan(0);
    expect(energy).toBeGreaterThan(0);
    expect(inPresence('ghost')).toBe(true);

    await setVeil(0);
    await waitFor(() => expect(inPresence('ghost')).toBe(false));
    const at = gameplay().entityPositions.ghost;
    const engine = gameplay().uniqueStates.ghost;
    expect(at).toBeDefined();
    for (let i = 0; i < 3; i++) await turn();
    expect(ghostStat('count')).toBe(count);
    expect(ghostStat('energy')).toBe(energy);
    expect(gameplay().entityPositions.ghost).toBe(at);
    expect(gameplay().uniqueStates.ghost.startId).toBe(engine.startId);
    expect(gameplay().uniqueStates.ghost.stop).toBe(engine.stop);
    // Its clock paused: the patrol idle it had left is still left.
    const idleLeft = (st = gameplay().uniqueStates.ghost) => st.idleEnd! - st.lastRun;
    expect(engine.idleEnd).toBeDefined();
    expect(gameplay().uniqueStates.ghost.lastRun).toBeGreaterThan(engine.lastRun);
    expect(idleLeft()).toBe(idleLeft(engine));

    await act(async () => { await gameplay().saveGame('slot', 'Sedge Landing', 'w1', 'save-off'); });
    cleanup();
    live = null;
    await start('save-off');
    await waitFor(() => expect(gameplay().entityPositions).toHaveProperty('mira'));
    expect(gameplay().entityPositions.ghost).toBe(at);
    expect(gameplay().uniqueStates.ghost?.startId).toBe(engine.startId);
    expect(ghostStat('count')).toBe(count);

    await setVeil(1);
    await waitFor(() => expect(inPresence('ghost')).toBe(true));
    expect(gameplay().entityPositions.ghost).toBe(at);
    await turn();
    expect(ghostStat('count')).toBe(count + 1);
  });
});
