import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'react-toastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameViewer } from '@/test/gameViewer';
import { PRE_EXPANSION_SHA, PRE_REFRESH_SHA, withoutAStat, worldAt } from '@/test/bundledRevisions';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { useGameplay } from '@/contexts/GameplayContext';
import { DEFAULT_WORLDS, seedWorldData } from '@/lib/defaultWorlds';
import type { SaveRecord, World } from '@/types';

/**
 * A save made against a bundled world's pre-refresh or pre-expansion revision loads against the current file and
 * plays a turn. `GameplayContext.bundledSaves.test.tsx` loads and settles every world at every revision.
 */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const raws = import.meta.glob<string>('@/defaultworlds/{drone,emberwatch,open-chat,rampage,slime}.json', { query: '?raw', import: 'default', eager: true });
const currentRaw = (id: string): Record<string, unknown> =>
  JSON.parse(Object.entries(raws).find(([path]) => path.endsWith(`/${id}.json`))![1]);

/** Every chat request gets one plain sentence; the model list is reachable. */
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    return sseResponse(sseReply('The wind shifts and the scene holds still.'));
  }));
}

let assistantTurns = 0;
function Probe() {
  const { fullMessageHistory } = useGameplay();
  assistantTurns = fullMessageHistory.filter((m) => m.role === 'assistant').length;
  return null;
}

/** Close the readme the world shows on entry, as a player does before typing. */
async function closeReadme(world: World) {
  if (!world.worldOverview.readme?.trim()) return;
  const readme = await screen.findByRole('dialog', { name: 'Readme' });
  fireEvent.click(within(readme).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Readme' })).toBeNull());
}

/** Send one action and wait for its turn to land in history. */
async function playTurn(action: string) {
  const box = await screen.findByPlaceholderText(/Type your action/);
  fireEvent.change(box, { target: { value: action } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
  const before = assistantTurns;
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(assistantTurns).toBe(before + 1), { timeout: 15_000 });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate Narration' })).toBeEnabled(), { timeout: 15_000 });
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  assistantTurns = 0;
  vi.mocked(toast.error).mockClear();
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

const turnsIn = (save: SaveRecord) => (save.messageHistory ?? []).filter((m) => m.role === 'assistant').length;

/** Play a turn on `before`, then load that save against `after` and play one more. */
async function playSaveAcross(before: World, after: World) {
  const played = renderGameViewer(before, { inGameplay: <Probe /> });
  stubEndpoint();
  await closeReadme(before);
  await playTurn('I look around.');
  const savedTurns = assistantTurns;
  // Wait for the autosave that holds the played turn; it replaces any earlier one.
  await waitFor(async () => expect((await getAllSaveRecords()).map(turnsIn)).toEqual([savedTurns]));
  const [save] = await getAllSaveRecords();
  played.unmount();
  cleanup();

  renderGameViewer(after, { inGameplay: <Probe />, initialSaveId: save.id });
  stubEndpoint();
  await closeReadme(after);
  await screen.findByRole('button', { name: 'Regenerate Narration' });
  expect(assistantTurns).toBe(savedTurns);
  await playTurn('I keep going.');
  // Wait for this turn's autosave too, so it can't land after the next test clears the store.
  await waitFor(async () => expect((await getAllSaveRecords()).map(turnsIn)).toEqual([assistantTurns]));
  expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
}

const before = (id: string, sha: string) => seedWorldData(worldAt(sha, id), DEFAULT_WORLDS.find((seed) => seed.id === id)!);
const after = (id: string) => seedWorldData(currentRaw(id), DEFAULT_WORLDS.find((seed) => seed.id === id)!);

describe('a save of rampage', () => {
  it('made at the pre-refresh revision loads against the current world and plays a turn', { timeout: 60_000 }, async () => {
    await playSaveAcross(before('rampage', PRE_REFRESH_SHA), after('rampage'));
  });
});

describe('a save of drone', () => {
  it('made at the pre-expansion revision loads against the current world and plays a turn', { timeout: 60_000 }, async () => {
    await playSaveAcross(before('drone', PRE_EXPANSION_SHA), after('drone'));
  });
});

describe('a save of emberwatch', () => {
  it('made at the pre-expansion revision loads against the current world and plays a turn', { timeout: 60_000 }, async () => {
    await playSaveAcross(before('emberwatch', PRE_EXPANSION_SHA), after('emberwatch'));
  });
});

describe('a save of open-chat', () => {
  it('made at the pre-refresh revision loads against the current world and plays a turn', { timeout: 60_000 }, async () => {
    await playSaveAcross(before('open-chat', PRE_REFRESH_SHA), after('open-chat'));
  });
});

describe('a save of slime', () => {
  // Q10: drift is accepted, so a stat the world cut leaves play unbroken.
  it('plays a turn after the world cuts a stat the save holds', { timeout: 60_000 }, async () => {
    await playSaveAcross(before('slime', PRE_REFRESH_SHA), withoutAStat(after('slime'))!);
  });
});
