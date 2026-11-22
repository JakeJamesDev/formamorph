import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { oneRoutine } from '@/test/routines';
import { phValues } from '@/test/placeholderValues';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { closedTurns } from '@/lib/memoryView';
import { encodePlaceholderToken } from '@/lib/placeholders';
import type { ChatMessage, Entity, Opening, PlayerStat, Script, World } from '@/types';

/** Scripts read the Drawn Opening through `opening` in play: At Game Start, later turns, and after a re-roll. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, name: string): PlayerStat => ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] });
const lamp = { id: 'ph-lamp', name: 'Lamp', values: phValues(['brass']) };
const lampChip = encodePlaceholderToken({ id: 'ph-lamp', mode: 'world', placementId: 'pl-lamp' });

/** What a script writes for each read: 1 for no Opening, 2 for the lantern row with every field as authored, 3 for the
 *  wick row, 4 for the harbor's, 5 for the world's, 9 for anything else. */
const READ = `opening === null ? 1
  : opening.category === 'opening' && opening.name === 'lantern' && opening.id === 'o1' && opening.kind === 'action' && opening.self === false
    && opening.time === 'night' && opening.weather === null && opening.text === 'Pell lifts a brass lantern.'
    && opening.owner === entities.Pell && opening.owner.category === 'entity' ? 2
  : opening.name === 'wick' && opening.owner === entities.Pell ? 3
  : opening.owner === locations.Harbor && opening.owner.category === 'location' && opening.kind === 'narration' ? 4
  : opening.owner === null && opening.text === 'The tide turns.' ? 5 : 9`;
const scripts: Script[] = [
  { id: 'start', timing: 'start', code: `stats.Start.value = ${READ};` },
  { id: 'after', timing: 'after', code: `stats.Later.value = ${READ};` },
];

const lantern: Opening = { id: 'o1', name: 'lantern', text: `Pell lifts a ${lampChip} lantern.`, kind: 'action', time: 'night' };
const wick: Opening = { id: 'o2', name: 'wick', text: 'Pell trims a wick.', kind: 'action' };
const pell = (openings: Opening[]): Entity => ({
  id: 'pell', name: 'Pell', kind: 'unique', knownIn: ['harbor'], aiDescription: 'A lamplighter.', openings,
  routines: oneRoutine([{ id: 'stall', place: 'harbor', weight: 1, schedule: [{ id: 'day', time: 'allDay', action: { kind: 'stay', place: 'harbor' } }] }]),
} as Entity);
const worldWith = (over: { entities?: Entity[]; harbor?: Opening[]; world?: Opening[] } = {}): World => {
  const world = harborWorld({ stats: [stat('start', 'Start'), stat('later', 'Later')], entities: over.entities ?? [] });
  return {
    ...world,
    worldOverview: { ...world.worldOverview, ...(over.world && { openings: over.world }) },
    locations: [{ ...world.locations[0], ...(over.harbor && { openings: over.harbor }) }],
    placeholders: [lamp],
    scripts,
  };
};

let history: ChatMessage[] = [];
let play: ReturnType<typeof useGameplay> | null = null;
function Probe() {
  play = useGameplay();
  history = play.fullMessageHistory;
  return null;
}
const valueOf = (id: string) => play?.globalStats.find((s) => s.id === id)?.value;

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

const turnDone = () => waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Stats' })).toBeEnabled());

async function enter(world: World) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
}

async function send() {
  const turns = closedTurns(history);
  const box = screen.getByPlaceholderText(/Type your action/);
  if (!(box as HTMLTextAreaElement).value) fireEvent.change(box, { target: { value: 'Look around.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(closedTurns(history)).toBe(turns + 1));
  await turnDone();
}

/** A Narration Opening starts on its own; wait for page one to close. */
const pageOne = async () => {
  await waitFor(() => expect(closedTurns(history)).toBe(1));
  await turnDone();
};

describe('the opening global in play', () => {
  it('reads the drawn entity Opening in At Game Start and on later turns, its chip filled in', async () => {
    await enter(worldWith({ entities: [pell([lantern])] }));
    await send();
    expect(valueOf('start')).toBe(2);
    expect(valueOf('later')).toBe(2);
    await act(async () => { play?.setGlobalStats(play.globalStats.map((s) => (s.id === 'later' ? { ...s, value: 0 } : s))); });
    await send();
    expect(valueOf('later')).toBe(2);
  });

  it('reads a location Opening with its location entry as owner', async () => {
    await enter(worldWith({ harbor: [{ id: 'h1', text: 'Gulls wheel over the pier.', kind: 'narration' }] }));
    await pageOne();
    expect(valueOf('start')).toBe(4);
    expect(valueOf('later')).toBe(4);
  });

  it('reads a world Opening with no owner', async () => {
    await enter(worldWith({ world: [{ id: 'w1', text: 'The tide turns.', kind: 'action' }] }));
    await send();
    expect(valueOf('start')).toBe(5);
  });

  it('reads null for the shipped default opening', async () => {
    await enter(worldWith());
    await send();
    expect(valueOf('start')).toBe(1);
    expect(valueOf('later')).toBe(1);
  });

  it('reads the new Opening after a page-one re-roll draws another row', async () => {
    await enter(worldWith({ entities: [pell([lantern, wick])] }));
    await send();
    const first = valueOf('start');
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Narration' }));
    await waitFor(() => expect(closedTurns(history)).toBe(0));
    await send();
    expect([first, valueOf('start')].sort()).toEqual([2, 3]);
    expect(valueOf('later')).toBe(valueOf('start'));
  });
});
