import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import type { PlayerStat, Script, World } from '@/types';

/** The At Game Start timing on a mounted game: it shapes the opening request, and a loaded save never runs it. */

// The hosted build: the Default preset is the Demo AI, so entering a game raises the gate the tests dismiss.
vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };

/** Adds ten to Vigor, so a script that ran twice shows as a different number than one that ran once. */
const startScript: Script = { id: 'start', timing: 'start', code: 'stats.Vigor.value = stats.Vigor.value + 10;' };

/** The world's own narrator prompt, so the request carries the stat's value where the shipped one names a level. */
const NARRATOR_PROMPT = 'Narrate the scene.';

const worldWith = (scripts: Script[]): World => {
  const world = harborWorld({ stats: [vigor] });
  return {
    ...world,
    worldOverview: { ...world.worldOverview, promptOverrides: { systemPrompt: `${NARRATOR_PROMPT}\n<STATS DESCRIPTION|numbers>` } },
    scripts,
  };
};

const NARRATION = 'The ferry bell rings twice across the water.';

/** The system prompts the narrator and the stat tracker got, oldest first. */
let narrations: string[];
let statRequests: string[];
/** How many narration calls still fail before the endpoint answers. */
let narrationFailures: number;

/** A scripted endpoint: narration, choices and a stat reply that moves nothing. */
function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Ring the bell\n2. Wait at the dock'));
    if (system.includes('stat tracker')) {
      statRequests.push(system);
      return sseResponse(sseReply('No changes.'));
    }
    if (system.startsWith(NARRATOR_PROMPT)) {
      narrations.push(system);
      if (narrationFailures > 0) {
        narrationFailures -= 1;
        return new Response('The model is down.', { status: 400 });
      }
      return sseResponse(sseReply(NARRATION));
    }
    return sseResponse(sseReply('Nothing to record.'));
  }));
}

beforeEach(async () => {
  // Storage is real and outlives a test, so each starts with no saves.
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  narrations = [];
  statRequests = [];
  narrationFailures = 0;
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

/** Enter the world as a new game and send the opening action. */
async function playOpening(world: World) {
  const view = renderGameViewer(world);
  const box = await screen.findByPlaceholderText(/Type your action/);
  stubEndpoint();
  fireEvent.change(box, { target: { value: 'I walk the pier.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Narration' })).toBeEnabled());
  return view;
}

/** Regenerate page one: the opening returns to the box for the player to submit again. */
const regenerateOpening = async () => {
  const before = narrations.length;
  fireEvent.click(screen.getByRole('button', { name: 'Re-generate Narration' }));
  await waitFor(() => expect(screen.getByPlaceholderText(/Type your action/)).not.toHaveValue(''));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(narrations.length).toBe(before + 1));
  return narrations.at(-1)!;
};

describe('a new game with a start script', () => {
  it('opens on the stat the script wrote', async () => {
    await playOpening(worldWith([startScript]));
    expect(narrations).toHaveLength(1);
    expect(narrations[0]).toContain('Vigor: 60/100');
  });

  it('hands the state it leaves to the before box, which then runs over it', async () => {
    const world = worldWith([startScript]);
    const stat = { ...vigor, scripts: [{ id: 'hp:before', timing: 'before' as const, code: 'return self.value + 5;' }] };
    await playOpening({ ...world, stats: [stat] });
    expect(narrations[0]).toContain('Vigor: 65/100');
  });

  it('opens on the authored stat when the world has no start script', async () => {
    await playOpening(worldWith([]));
    expect(narrations[0]).toContain('Vigor: 50/100');
  });

  it('runs again when page one is regenerated, over the pre-game state it restores', async () => {
    await playOpening(worldWith([startScript]));
    const regenerated = await regenerateOpening();
    expect(regenerated).toContain('Vigor: 60/100');
  });
});

describe('a new game whose opening is redone', () => {
  it('keeps the start write when only the stats of page one are re-rolled', async () => {
    await playOpening(worldWith([startScript]));

    const before = statRequests.length;
    fireEvent.click(screen.getByRole('button', { name: 'Re-generate Stats' }));
    await waitFor(() => expect(statRequests.length).toBe(before + 1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Re-generate Stats' })).toBeEnabled());

    // The next turn's prompt reads the stat the re-roll left.
    fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'I ring the bell.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(narrations).toHaveLength(2));
    expect(narrations[1]).toContain('Vigor: 60/100');
  });

  it('runs the start script once on the retry of an opening that failed', async () => {
    narrationFailures = 1;
    const world = worldWith([startScript]);
    renderGameViewer(world);
    const box = await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint();
    fireEvent.change(box, { target: { value: 'I walk the pier.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(narrations).toHaveLength(1));
    // The failed opening puts back the pre-start state; the player sends the action again.
    fireEvent.change(screen.getByPlaceholderText(/Type your action/), { target: { value: 'I walk the pier.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(narrations).toHaveLength(2));
    expect(narrations[1]).toContain('Vigor: 60/100');
    expect(narrations[1]).not.toContain('Vigor: 70/100');
  });
});

describe('a loaded save', () => {
  it('regenerates page one with the start write applied once', async () => {
    const world = worldWith([startScript]);
    const played = await playOpening(world);
    await waitFor(async () => expect(await getAllSaveRecords()).toHaveLength(1));
    const [save] = await getAllSaveRecords();
    played.unmount();
    cleanup();

    renderGameViewer(world, { initialSaveId: save.id });
    // The harness stubs fetch again on every render, so the scripted endpoint goes back in after it.
    stubEndpoint();
    await screen.findByRole('button', { name: 'Re-generate Narration' });
    expect(narrations).toHaveLength(1);

    const regenerated = await regenerateOpening();
    expect(regenerated).toContain('Vigor: 60/100');
    expect(regenerated).not.toContain('Vigor: 70/100');
  });
});
