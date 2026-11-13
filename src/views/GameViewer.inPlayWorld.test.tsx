import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { playTurn, resetMoveTurnStorage, stubMoveEndpoint } from '@/test/moveTurns';
import { forceOff } from '@/test/inPlayOverride';
import { useGameplay } from '@/contexts/GameplayContext';
import { usePresence } from '@/lib/usePresence';
import { useResolvedWorld } from '@/lib/useResolvedWorld';
import { phValues } from '@/test/placeholderValues';
import type { Presence } from '@/lib/presence';
import type { DiscoveredEntity, Entity, GameLocation, Placeholder, PlayerStat, World } from '@/types';

/**
 * Reader coverage: an entity and a location the In-Play World resolver turns off reach no in-play reader.
 * Each case forces them off and reads the reader's output, beside a twin that stays on as the control.
 */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/lib/inPlayGates', async (original) => (await import('@/test/inPlayOverride')).withForcedOff(original));
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const HARBOR = { id: 'harbor', name: 'Harbor', isStarting: true } as GameLocation;
const MARKET = { id: 'market', name: 'Market' } as GameLocation;
const CELLAR = { id: 'cellar', name: 'Cellar' } as GameLocation;
const unique = (id: string, name: string, at: string): Entity => ({
  id, name, kind: 'unique', locations: [at], knownIn: ['harbor'],
  starts: [{ id: `${id}-start`, place: at, weight: 1, schedule: [] }],
});
// Mira stands here; Wren and Ghost one step away at the Market, both known at the Harbor.
const mira = unique('mira', 'Mira', 'harbor');
const wren = unique('wren', 'Wren', 'market');
const ghost = unique('ghost', 'Ghost', 'market');
const world: World = {
  ...harborWorld({ entities: [mira, wren, ghost] }),
  locations: [HARBOR, MARKET, CELLAR],
  connections: [
    { id: 'quay', a: 'harbor', b: 'market', aToB: {}, bToA: {} },
    { id: 'stair', a: 'harbor', b: 'cellar', aToB: {}, bToA: {} },
  ],
};

let live: ReturnType<typeof useGameplay> | null = null;
let presence: Presence | null = null;
const Probe = () => { live = useGameplay(); presence = usePresence(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const presenceIds = () => {
  if (!presence) throw new Error('no presence yet');
  const { byId, lookAround, inScene, met, known } = presence;
  return new Set([...byId.keys(), ...[...lookAround, ...inScene, ...met, ...known].map((p) => p.entity.id)]);
};

async function start(on: World = world, initialSaveId?: string) {
  renderGameViewer(on, { inGameplay: <Probe />, initialSaveId });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().currentLocation).not.toBeNull());
}

/** A character the director invented at the Harbor. */
const drifter: DiscoveredEntity = { entity: { id: 'drifter', name: 'Drifter' }, locationId: 'harbor', sourceTurnId: 't0' };
const addDrifter = () => act(() => { gameplay().setDiscoveredEntities([drifter]); });

/** Every message the game sent the AI in one turn, as one text. The narration walks the player to the Cellar. */
async function turnText() {
  const sent: string[] = [];
  stubMoveEndpoint('The tide turns.', { narrated: 'Cellar' });
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

describe('an entity and a location the resolver turns off', () => {
  it('are in no position, presence or AI request', async () => {
    forceOff({ entities: ['ghost', 'drifter'], locations: ['cellar'] });
    await start();
    addDrifter();
    expect(gameplay().currentLocation?.id).toBe('harbor');
    // Routines and positions.
    await waitFor(() => expect(gameplay().entityPositions).toMatchObject({ mira: 'harbor', wren: 'market' }));
    expect(gameplay().entityPositions).not.toHaveProperty('ghost');
    // Presence and the scene cast.
    expect(presenceIds()).toContain('wren');
    expect(presenceIds()).not.toContain('ghost');
    expect(presenceIds()).not.toContain('drifter');
    // The AI context, chip values, Known In and the router's candidates, as sent.
    const text = await turnText();
    expect(text).toContain('Wren');
    expect(text).toContain('Market');
    expect(text).not.toContain('Ghost');
    expect(text).not.toContain('Drifter');
    expect(text).not.toContain('Cellar');
    // The move the narration named is matched against the router's candidates, which lack the Cellar.
    expect(gameplay().currentLocation?.id).toBe('harbor');
    // The turn's own placement reads the routines again.
    expect(gameplay().entityPositions).not.toHaveProperty('ghost');
  });

  it('reach every reader while on', async () => {
    await start();
    addDrifter();
    await waitFor(() => expect(gameplay().entityPositions).toHaveProperty('ghost', 'market'));
    expect(presenceIds()).toContain('ghost');
    expect(presenceIds()).toContain('drifter');
    const text = await turnText();
    expect(text).toContain('Ghost');
    expect(text).toContain('Drifter');
    expect(text).toContain('Cellar');
    await waitFor(() => expect(gameplay().currentLocation?.id).toBe('cellar'));
  });

  it('are placed by no save load', async () => {
    forceOff({ entities: ['ghost'] });
    await start();
    await act(async () => { await gameplay().saveGame('slot', 'Sedge Landing', 'w1', 'save-off'); });
    cleanup();
    live = null;
    await start(world, 'save-off');
    await waitFor(() => expect(gameplay().entityPositions).toMatchObject({ mira: 'harbor', wren: 'market' }));
    expect(gameplay().entityPositions).not.toHaveProperty('ghost');
  });
});

// Ghost carries a default-on trait that pins Mood, and an After script reads who and where the play has.
const moodPin: Placeholder = { id: 'mood', name: 'Mood', values: phValues(['calm', 'fierce']) };
const ghostWithPin: Entity = { ...ghost, traits: [{ id: 't-ghost', name: 'Eerie', statChanges: [], placeholderPins: [{ placeholderId: 'mood', value: 'fierce' }] }] };
const seenStat = (id: string, name: string): PlayerStat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 0, regen: 0, descriptors: [] });
const readers: World = {
  ...harborWorld({ entities: [mira, wren, ghostWithPin], stats: [seenStat('sg', 'SeesGhost'), seenStat('sc', 'SeesCellar'), seenStat('sd', 'SeesDrifter')] }),
  locations: world.locations,
  connections: world.connections,
  placeholders: [moodPin],
  scripts: [{
    id: 'who', timing: 'after',
    code: 'if (entities.Ghost.name === "Ghost") stats.SeesGhost.value = 1; if (locations.Cellar.name === "Cellar") stats.SeesCellar.value = 1; if (entities.Drifter.name === "Drifter") stats.SeesDrifter.value = 1;',
  }],
} as unknown as World;

const Resolved = () => { resolved = useResolvedWorld(); return null; };
let resolved: ReturnType<typeof useResolvedWorld> | null = null;
const resolvedWorld = () => {
  if (!resolved) throw new Error('no resolved world yet');
  return resolved;
};
const statValue = (name: string) => gameplay().globalStats.find((s) => s.name === name)?.value;

async function startReaders() {
  renderGameViewer(readers, { inGameplay: <><Probe /><Resolved /></>, initialOwnedTraits: { ghost: ['t-ghost'] } });
  await screen.findByPlaceholderText(/Type your action/);
  await waitFor(() => expect(gameplay().currentLocation).not.toBeNull());
}

describe('the readers outside the cast', () => {
  it('see no off entity or location: the script globals, the pins and the stat code cast', async () => {
    forceOff({ entities: ['ghost'], locations: ['cellar'] });
    await startReaders();
    stubMoveEndpoint('The tide turns.', {});
    await playTurn(gameplay, 'Look around');
    expect(statValue('SeesGhost')).toBe(0);
    expect(statValue('SeesCellar')).toBe(0);
    expect(resolvedWorld().pins).not.toHaveProperty('mood');
    expect(resolvedWorld().codeEntities.world.map((e) => e.id)).not.toContain('ghost');
  });

  it('see them while they are on', async () => {
    await startReaders();
    stubMoveEndpoint('The tide turns.', {});
    await playTurn(gameplay, 'Look around');
    expect(statValue('SeesGhost')).toBe(1);
    expect(statValue('SeesCellar')).toBe(1);
    expect(resolvedWorld().pins).toHaveProperty('mood', 'fierce');
    expect(resolvedWorld().codeEntities.world.map((e) => e.id)).toContain('ghost');
  });

  it('see an off runtime character in the script globals', async () => {
    forceOff({ entities: ['drifter'] });
    await startReaders();
    addDrifter();
    stubMoveEndpoint('The tide turns.', {});
    await playTurn(gameplay, 'Look around');
    expect(statValue('SeesDrifter')).toBe(0);
  });

  it('see a runtime character while it is on', async () => {
    await startReaders();
    addDrifter();
    stubMoveEndpoint('The tide turns.', {});
    await playTurn(gameplay, 'Look around');
    expect(statValue('SeesDrifter')).toBe(1);
  });
});

describe('the new-game start pick', () => {
  // The Cellar is the only starting location, so the pick falls back to the rest once it is off.
  const cellarStart: World = { ...world, locations: [{ ...CELLAR, isStarting: true }, { ...HARBOR, isStarting: false }] };

  it('never starts in a location the resolver turns off', async () => {
    forceOff({ locations: ['cellar'] });
    await start(cellarStart);
    expect(gameplay().currentLocation?.id).toBe('harbor');
  });

  it('starts there while it is on', async () => {
    await start(cellarStart);
    expect(gameplay().currentLocation?.id).toBe('cellar');
  });
});
