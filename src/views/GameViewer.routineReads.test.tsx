import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { sseResponse, sseReply } from '@/test/aiTextFixtures';
import { deleteSaveRecord, getAllSaveRecords } from '@/components/modals/dbUtils';
import { runTestCode, statCodeNames, statHomeNamed } from '@/lib/statCodeTestRun';
import type { Connection, Entity, GameLocation, PlayerStat, World } from '@/types';
import { oneRoutine } from '@/test/routines';

/** The four routine reads on the opening turn of a mounted game equal what Test Code reads on the same world. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

/** Each check is one bit of the value, so the narrator prompt carries every read. */
const CHECKS = [
  'entities.Tess.kind === "unique"', 'entities.Moths.kind === "generic"', 'entities.Plain.kind === ""',
  'entities.Tess.action === "wander"', 'entities.Bram.action === "stay"', '!entities.Bram.held && !entities.Tess.held',
  'entities.Moths.action === ""', 'entities.Tess.knownIn === "nowhere"', 'entities.Bram.knownIn === "picked"',
  'entities.Bram.knownInPlaces.join() === "Inn"', 'entities.Plain.knownIn === "nearby"',
  'JSON.stringify(location.exits.map((e) => [e.name, e.distance, e.oneWay])) === \'[["Inn","nearby",false],["Dock","far",false],["Cove","nearby",true]]\'',
];
const ALL = 2 ** CHECKS.length - 1;
const CODE = `return [${CHECKS.join(', ')}].reduce((mask, ok, bit) => mask + (ok ? 2 ** bit : 0), 0);`;

const probe: PlayerStat = {
  id: 'probe', name: 'Probe', type: 'number', description: '', min: 0, max: 10000, value: 0, regen: 0, descriptors: [],
  scripts: [{ id: 'probe:before', timing: 'before', code: CODE }],
};

const locations: GameLocation[] = [
  { id: 'harbor', name: 'Harbor', isStarting: true }, { id: 'inn', name: 'Inn', parentId: 'harbor' },
  { id: 'dock', name: 'Dock' }, { id: 'cove', name: 'Cove' },
];
const connections: Connection[] = [
  { id: 'c-dock', a: 'harbor', b: 'dock', aToB: {}, bToA: {}, distance: 'far' },
  { id: 'c-cove', a: 'harbor', b: 'cove', aToB: {} },
];
const entities: Entity[] = [
  {
    id: 'tess', name: 'Tess', kind: 'unique', locations: ['harbor', 'inn'], knownIn: 'nowhere',
    routines: oneRoutine([{ id: 's-tess', place: 'harbor', weight: 1, schedule: [{
      id: 'w', time: 'allDay', action: { kind: 'wander', places: [{ place: 'harbor', weight: 1 }, { place: 'inn', weight: 1 }], idle: 30 },
    }] }], []),
  },
  {
    id: 'bram', name: 'Bram', kind: 'unique', locations: ['harbor'], knownIn: ['inn'],
    routines: oneRoutine([{ id: 's-bram', place: 'harbor', weight: 1, schedule: [{ id: 'st', time: 'allDay', action: { kind: 'stay', place: 'harbor' } }] }], []),
  },
  { id: 'moths', name: 'Moths', kind: 'generic', locations: ['inn'], routines: oneRoutine([{ id: 's-moths', place: 'inn', weight: 1, schedule: [] }]) },
  { id: 'plain', name: 'Plain' },
];

const NARRATOR_PROMPT = 'Narrate the scene.';

const world = (): World => {
  const base = harborWorld({ stats: [probe], entities });
  return {
    ...base, locations, connections,
    worldOverview: { ...base.worldOverview, promptOverrides: { systemPrompt: `${NARRATOR_PROMPT}\n<STATS DESCRIPTION|numbers>` } },
  };
};

let narrations: string[];

function stubEndpoint() {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.body) return new Response(JSON.stringify({ data: [{ id: 'm' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const { messages } = JSON.parse(init.body as string) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    if (system.includes('player choice writer')) return sseResponse(sseReply('1. Wait\n2. Leave'));
    if (system.startsWith(NARRATOR_PROMPT)) {
      narrations.push(system);
      return sseResponse(sseReply('The bell rings.'));
    }
    return sseResponse(sseReply('No changes.'));
  }));
}

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  narrations = [];
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_endpointUrl', 'http://127.0.0.1:5190/v1/chat/completions');
  localStorage.setItem('FORMAMORPH_thinkingMode', 'off');
});

describe('the routine reads at the opening hour', () => {
  it('read the same in play and in Test Code', async () => {
    const played = world();
    const home = statHomeNamed(played, statCodeNames(played), 'Probe')!;
    const report = await runTestCode(CODE, 'before', home, played);
    expect(report.error).toBeNull();
    expect(report.value).toBe(ALL);

    renderGameViewer(played);
    const box = await screen.findByPlaceholderText(/Type your action/);
    stubEndpoint();
    fireEvent.change(box, { target: { value: 'I look around.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(narrations).toHaveLength(1));
    expect(narrations[0]).toContain(`Probe: ${ALL}/10000`);
  });
});
