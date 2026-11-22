import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { oneRoutine } from '@/test/routines';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords, getSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { resolveDrawnOpening } from '@/lib/drawnOpening';
import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { ChatMessage, Entity, GameLocation, Opening, PlayerStat, SaveRecord, World } from '@/types';

/** The Drawn Opening the save records: written at New Game, rewritten by a page-one re-roll, read back on load. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

// The turn-done wait reads the Regenerate Stats button, which shows only in a world with stats.
const mood: PlayerStat = { id: 'mood', name: 'Mood', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
const plainWorld = (): World => harborWorld({ stats: [mood] });
const action = (id: string, text: string): Opening => ({ id, text, kind: 'action' });
const pell = (openings: Opening[]): Entity => ({
  id: 'pell', name: 'Pell', kind: 'unique', knownIn: ['harbor'], aiDescription: 'A lamplighter.', openings,
  routines: oneRoutine([{ id: 'stall', place: 'harbor', weight: 1, schedule: [{ id: 'day', time: 'allDay', action: { kind: 'stay', place: 'harbor' } }] }]),
} as Entity);
const entityWorld = (openings: Opening[]): World => harborWorld({ stats: [mood], entities: [pell(openings)] });
const locationWorld = (): World => {
  const world = plainWorld();
  const harbor: GameLocation = { ...world.locations[0], openings: [action('o1', 'Gulls wheel over the pier.')] };
  return { ...world, locations: [harbor] };
};

let history: ChatMessage[] = [];
let play: ReturnType<typeof useGameplay> | null = null;
function Probe() {
  play = useGameplay();
  history = play.fullMessageHistory;
  return null;
}
const live = () => {
  if (!play) throw new Error('gameplay not mounted');
  return play;
};

function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Ring the bell\n2. Wait at the dock'));
    if (system.includes('stat tracker')) return sseResponse(sseReply('No changes.'));
    return sseResponse(sseReply('The ferry bell rings twice across the water.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

const box = () => screen.getByPlaceholderText(/Type your action/);
const turnDone = () => waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());

async function enter(world: World) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
}

async function send() {
  const turns = closedTurns(history);
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(closedTurns(history)).toBe(turns + 1));
  await turnDone();
}

async function saved(id: string): Promise<SaveRecord> {
  await act(async () => { await live().saveGame('slot', 'Sedge Landing', 'w1', id); });
  return await getSaveRecord(id) as SaveRecord;
}

async function reload(id: string, world: World) {
  await act(async () => { await live().loadGame(id, world.locations, world.stats); });
  await turnDone();
}

async function rerollPageOne() {
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate Narration' }));
  await waitFor(() => expect(closedTurns(history)).toBe(0));
}

const sourcesOf = (world: World) => ({ overview: world.worldOverview, entities: world.entities, locations: world.locations });

describe('the save records the Drawn Opening', () => {
  it('names the entity and Opening a new game drew, and a load resolves it against the current world', async () => {
    const world = entityWorld([action('o1', 'Pell lifts a lantern.')]);
    await enter(world);
    await waitFor(() => expect(box()).toHaveValue('Pell lifts a lantern.'));
    await send();
    expect((await saved('entity')).drawnOpening).toEqual({ ownerId: 'pell', openingId: 'o1' });

    await act(async () => { live().setDrawnOpening(null); });
    await reload('entity', world);
    expect(resolveDrawnOpening(live().drawnOpening, sourcesOf(world))).toMatchObject({ opening: { id: 'o1' }, owner: { category: 'entity' } });
    const deleted = entityWorld([]);
    expect(resolveDrawnOpening(live().drawnOpening, sourcesOf(deleted))).toBeNull();
  });

  it('carries the location id of a location-owned Opening', async () => {
    await enter(locationWorld());
    await waitFor(() => expect(box()).toHaveValue('Gulls wheel over the pier.'));
    await send();
    expect((await saved('location')).drawnOpening).toEqual({ ownerId: null, openingId: 'o1', locationId: 'harbor' });
  });

  it('writes none for the shipped default opening', async () => {
    await enter(plainWorld());
    await waitFor(() => expect(box()).toHaveValue(OPENING_SCENE_CUE));
    await send();
    expect((await saved('default')).drawnOpening).toBeUndefined();
    expect(live().drawnOpening).toBeNull();
  });

  it('loads a save with no record as none', async () => {
    const world = entityWorld([action('o1', 'Pell lifts a lantern.')]);
    await enter(world);
    await send();
    const { drawnOpening: _dropped, ...older } = await saved('older');
    await putSaveRecord(older as SaveRecord);
    await reload('older', world);
    expect(live().drawnOpening).toBeNull();
  });
});

describe('a page-one re-roll', () => {
  it('rewrites the record when it draws another row', async () => {
    const world = entityWorld([action('o1', 'Pell lifts a lantern.'), action('o2', 'Pell trims a wick.')]);
    await enter(world);
    await send();
    const first = (await saved('first')).drawnOpening;
    await rerollPageOne();
    await send();
    const second = (await saved('second')).drawnOpening;
    expect(second?.ownerId).toBe('pell');
    expect(second?.openingId).not.toBe(first?.openingId);
  });

  it('leaves the record when the pool has only the row on screen', async () => {
    const world = entityWorld([action('o1', 'Pell lifts a lantern.')]);
    await enter(world);
    await send();
    const before = live().drawnOpening;
    await rerollPageOne();
    expect(live().drawnOpening).toBe(before);
    expect(before).toEqual({ ownerId: 'pell', openingId: 'o1' });
  });
});
