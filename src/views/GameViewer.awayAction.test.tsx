import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePresence } from '@/lib/usePresence';
import { mapReach, mapRoster } from '@/lib/mapRoster';
import type { Presence } from '@/lib/presence';
import type { Connection, Entity, GameLocation, PlayerStat, ScheduleAction, World } from '@/types';
import { oneRoutine } from '@/test/routines';

/**
 * An Away row in play: Pell begins at the Harbor where the player stands, and his all-day row is Away. He is in no
 * place-based reader (scene, here, nearby, the map, the AI's current location), stays in the known-entity readers,
 * and his stats regen and his script run (Q23, Q29). The Stay rows are the controls.
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
const pell = (action: ScheduleAction): Entity => ({
  id: 'pell', name: 'Pell', kind: 'unique', knownIn: ['harbor'], aiDescription: 'A lamplighter.',
  routines: oneRoutine([{ id: 'stall', place: 'harbor', weight: 1, schedule: [{ id: 'day', time: 'allDay', action }] }]),
  stats: [
    stat('count', 'Count', { scripts: [{ id: 'tick', timing: 'after', code: 'self.value += 1;' }] }),
    stat('energy', 'Energy', { regen: 5 }),
  ] as Entity['stats'],
});
const world = (action: ScheduleAction): World => ({
  ...harborWorld({ stats: [stat('seen', 'ProbeA')], entities: [pell(action)] }),
  locations: [HARBOR, LANE],
  connections: [QUAY],
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

async function start(on: World) {
  renderGameViewer(on, { inGameplay: <Probe /> });
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

describe('an Away row', () => {
  it('leaves every place-based reader, stays in the known-entity readers, and runs his stats and script', async () => {
    await start(world({ kind: 'away' }));
    const energy = pellStat('energy') ?? 0;
    const messages = await turnMessages();
    expect(gameplay().entityPositions.pell).toBeUndefined();
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

  it('reads him here on a Stay row at the Harbor', async () => {
    await start(world({ kind: 'stay', place: 'harbor' }));
    const messages = await turnMessages();
    expect(gameplay().entityPositions.pell).toBe('harbor');
    expect(section(messages, 'Entities in the Current Location')).toContain('Pell');
    expect(ids(seen().lookAround)).toContain('pell');
    expect(onMap()).toEqual(['harbor']);
  });

  it('reads him nearby on a Stay row at Lanternlane', async () => {
    await start(world({ kind: 'stay', place: 'lane' }));
    await turnMessages();
    expect(seen().byId.get('pell')).toMatchObject({ position: ['lane'], where: 'connected' });
    expect(onMap()).toEqual(['lane']);
  });
});
