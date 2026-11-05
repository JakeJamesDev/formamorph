import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseReply, sseResponse } from '@/test/aiTextFixtures';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { serializeTurnContent } from '@/lib/turnDigest';
import type { AITurnResult, ChatMessage, Entity, GameLocation, PlayerStat, World } from '@/types';

/** A script's `inScene` on a mounted game agrees with the Entities tab's In Scene. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const HARBOR = { id: 'harbor', name: 'Harbor', isStarting: true } as GameLocation;
const MARKET = { id: 'market', name: 'Market' } as GameLocation;
const stat = (id: string): PlayerStat => ({ id, name: id, type: 'number', description: '', min: -1, max: 9, value: -1, regen: 0, descriptors: [] });
const entity = (id: string, name: string, locations: string[]): Entity => ({ id, name, locations } as unknown as Entity);

const world: World = {
  ...harborWorld({
    stats: [stat('mira'), stat('pip')],
    // Mira stands at both places, so a move leaves her here. Pip is here and has not taken part.
    entities: [entity('mira', 'Mira', ['harbor', 'market']), entity('pip', 'Pip', ['harbor', 'market'])],
  }),
  locations: [HARBOR, MARKET],
  scripts: [{
    id: 'read', timing: 'before',
    code: 'stats.mira.value = entities.Mira.inScene ? 1 : 0;\nstats.pip.value = entities.Pip.inScene ? 1 : 0;',
  }],
} as unknown as World;

/** A closed turn at the harbor that Mira took part in. */
const closedTurn: ChatMessage[] = [
  { role: 'user', content: 'I look around.' },
  { role: 'assistant', content: serializeTurnContent({ id: 't1', sentence: 'Mira waves.', choices: [], entities: ['Mira'], locationId: 'harbor' } as unknown as AITurnResult) },
];

let play: ReturnType<typeof useGameplay>;
function Probe() {
  play = useGameplay();
  return null;
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

/** Plays one turn from the seeded history, at `at`, and returns what the Before script read. */
async function readAt(at: GameLocation) {
  renderGameViewer(world, { inGameplay: <Probe /> });
  const box = await screen.findByPlaceholderText(/Type your action/);
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => (init?.body
    ? sseResponse(sseReply('The gulls wheel overhead.'))
    : new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));
  act(() => {
    play.setFullMessageHistory(closedTurn);
    play.setCurrentLocation(at);
  });
  fireEvent.change(box, { target: { value: 'I wait.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  const value = (id: string) => play.globalStats.find((s) => s.id === id)?.value;
  await waitFor(() => expect(value('mira')).not.toBe(-1));
  return { mira: value('mira'), pip: value('pip') };
}

describe('a script’s inScene', () => {
  it('reads true for an entity that took part here, and false for an entity that is only here', async () => {
    expect(await readAt(HARBOR)).toEqual({ mira: 1, pip: 0 });
  });

  it('reads false after a move, for an entity also listed at the new location', async () => {
    expect(await readAt(MARKET)).toEqual({ mira: 0, pip: 0 });
  });
});
