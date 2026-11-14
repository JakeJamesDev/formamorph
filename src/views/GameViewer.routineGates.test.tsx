import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePresence } from '@/lib/usePresence';
import { mapReach, mapRoster } from '@/lib/mapRoster';
import type { Presence } from '@/lib/presence';
import type { Connection, Entity, EntityRoutine, GameLocation, PlayerStat, Trait, World } from '@/types';

/**
 * Routine gates in play. Pell lights the Harbor lanterns while the world holds Lanterns Lit, a setup pick, and
 * otherwise keeps to Lanternlane. Page one already shows the Routine the picks apply (Q12). With no fallback,
 * no Routine holds, and he reads as Away in every reader (Q24, Q29).
 */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, name: string, over: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], ...over });

const HARBOR: GameLocation = { id: 'harbor', name: 'Harbor', isStarting: true };
const LANE: GameLocation = { id: 'lane', name: 'Lanternlane' };
const QUAY: Connection = { id: 'quay', a: 'harbor', b: 'lane', aToB: {}, bToA: {} };
const LIT: Trait = { id: 'lit', name: 'Lanterns Lit', statChanges: [] };

const stayAt = (id: string, name: string, place: string, gated: boolean): EntityRoutine => ({
  id, name, starts: [{ id: `${id}-start`, place, weight: 1, schedule: [{ id: `${id}-row`, time: 'allDay', action: { kind: 'stay', place } }] }],
  ...(gated && { requires: [{ all: [{ kind: 'trait', id: 'lit' }] }] }),
});
const pell = (routines: EntityRoutine[]): Entity => ({
  id: 'pell', name: 'Pell', kind: 'unique', knownIn: ['harbor'], aiDescription: 'A lamplighter.', routines,
  stats: [
    stat('count', 'Count', { scripts: [{ id: 'tick', timing: 'after', code: 'self.value += 1;' }] }),
    stat('energy', 'Energy', { regen: 5 }),
  ] as Entity['stats'],
});
const LIGHTS = stayAt('lights', 'Lights', 'harbor', true);
const DARK = stayAt('dark', 'Dark', 'lane', false);
const world = (routines: EntityRoutine[]): World => ({
  ...harborWorld({ stats: [stat('seen', 'ProbeA')], entities: [pell(routines)] }),
  locations: [HARBOR, LANE],
  connections: [QUAY],
  traits: [LIT],
  scripts: [{ id: 'who', timing: 'after', code: 'if (entities.Pell.name === "Pell") stats.ProbeA.value = 1;' }],
} as World);

let live: ReturnType<typeof useGameplay> | null = null;
let presence: Presence | null = null;
const Probe = () => { live = useGameplay(); presence = usePresence(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const seen = () => {
  if (!presence) throw new Error('no presence yet');
  return presence;
};
const ids = (list: readonly { entity: Entity }[]) => list.map((p) => p.entity.id);
const pellStat = (id: string) => gameplay().entityStats.pell?.find((s) => s.id === id)?.value;

async function start(on: World, initialTraits?: string[]) {
  renderGameViewer(on, { inGameplay: <Probe />, ...(initialTraits && { initialTraits }) });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().currentLocation).not.toBeNull());
}
/** Every message one turn sent the AI, one text each. */
async function turnMessages(): Promise<string[]> {
  const sent: string[] = [];
  stubMoveEndpoint('The tide turns.', {});
  const answer = vi.mocked(fetch);
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (typeof init?.body === 'string') {
      const body = JSON.parse(init.body) as { messages?: { content?: unknown }[] };
      for (const m of body.messages ?? []) if (typeof m.content === 'string') sent.push(m.content);
    }
    return answer(url, init);
  }));
  await playTurn(gameplay, 'Look around');
  return sent;
}
/** The text under `heading` in every message, up to the next heading. */
const section = (messages: readonly string[], heading: string) =>
  messages.flatMap((m) => m.split(/^## /m).filter((part) => part.startsWith(`${heading}\n`))).join('\n');
/** Where the Map names Pell, by location id. */
const onMap = () => {
  const roster = mapRoster(seen().byId.values(), mapReach(gameplay().currentLocation?.id, [HARBOR, LANE], [QUAY]));
  return Object.keys(roster).filter((id) => roster[id].named.includes('Pell'));
};

beforeEach(async () => {
  await resetMoveTurnStorage();
  live = null;
  presence = null;
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the opening placement (Q12)', () => {
  it('opens on the Routine a setup pick applies', async () => {
    await start(world([LIGHTS, DARK]), ['lit']);
    expect(gameplay().entityPositions.pell).toBe('harbor');
    expect(gameplay().uniqueStates.pell).toMatchObject({ routineId: 'lights', startId: 'lights-start', rolls: { dark: 'dark-start' } });
    expect(gameplay().openingPlacement?.positions.pell).toBe('harbor');
  });

  it('opens on the fallback Routine without the pick', async () => {
    await start(world([LIGHTS, DARK]));
    expect(gameplay().entityPositions.pell).toBe('lane');
    expect(gameplay().uniqueStates.pell).toMatchObject({ routineId: 'dark', startId: 'dark-start' });
  });
});

describe('no Routine holds (Q24)', () => {
  it('leaves every place-based reader, stays in the known-entity readers, and runs his stats and script', async () => {
    await start(world([LIGHTS]));
    const energy = pellStat('energy') ?? 0;
    const messages = await turnMessages();
    expect(gameplay().entityPositions.pell).toBeUndefined();
    expect(gameplay().uniqueStates.pell).toMatchObject({ nowhere: true });
    // Scene and here.
    expect(section(messages, 'Entities in the Current Location')).not.toContain('Pell');
    expect(ids(seen().lookAround)).not.toContain('pell');
    expect(ids(seen().inScene)).not.toContain('pell');
    // Nearby and the map.
    expect(seen().byId.get('pell')).toMatchObject({ position: [], where: 'elsewhere' });
    expect(onMap()).toEqual([]);
    // Known-entity readers keep him.
    expect(section(messages, 'Entities Known Here')).toContain('Pell');
    expect(ids(seen().known)).toContain('pell');
    // Still running: the script globals, his own script and his regen.
    expect(gameplay().globalStats.find((s) => s.name === 'ProbeA')?.value).toBe(1);
    expect(pellStat('count')).toBe(1);
    expect(pellStat('energy')).toBeGreaterThan(energy);
  });

  it('reads him here once the pick holds his Routine', async () => {
    await start(world([LIGHTS]), ['lit']);
    const messages = await turnMessages();
    expect(gameplay().entityPositions.pell).toBe('harbor');
    expect(section(messages, 'Entities in the Current Location')).toContain('Pell');
    expect(ids(seen().lookAround)).toContain('pell');
    expect(onMap()).toEqual(['harbor']);
  });
});
