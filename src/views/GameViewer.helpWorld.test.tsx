import { cleanup, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords, putSaveRecord } from '@/components/modals/dbUtils';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import { createCodeTest, HELP_CODE_TEST } from '@/lib/formaquestion/helpCodeTest';
import { statCodeNames } from '@/lib/statCodeTestRun';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { runToolCall } from '@/lib/tools/toolRunner';
import type { Entity, PlayerStat, SaveRecord, Trait, World } from '@/types';

/** What the game registers for Formaquestion: a Tool and the code test read the Player View (Q20). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const stat = (id: string, over: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id, name: id, type: 'number', description: '', min: 0, max: 100, value: 10, regen: 0, descriptors: [], ...over });

const keeper: Entity = {
  id: 'keeper', name: 'Odd Wick', aliases: ['The Smuggler King'],
  playerDescription: 'The lamp-keeper.', aiDescription: 'Secretly runs the smuggling ring.', locations: ['harbor'],
};
const stranger: Entity = {
  id: 'stranger', name: 'Velka Thorn', playerDescription: 'A tall woman in grey.', aiDescription: 'The heir in hiding.', locations: ['vault'],
};
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], playerToggle: true };
const cursed: Trait = { id: 'cursed', name: 'Cursed', statChanges: [], playerToggle: true, mode: 'hidden' };

const world = (): World => ({
  ...harborWorld({
    stats: [stat('Coins'), stat('Suspicion', { hidden: true }), stat('Frozen', { enabled: false })],
    entities: [keeper, stranger],
  }),
  locations: [{ id: 'harbor', name: 'Harbor', isStarting: true }, { id: 'vault', name: 'Sunken Vault', aiDescription: 'Where the heir hides.' }],
  traits: [brave, cursed],
});

const GET_ENTITY = TOOL_CATALOG.find((t) => t.id === 'get_entity')!;

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
});

/** The game loaded from a save in which the player has met the keeper at the harbor and picked both traits. */
async function openGame() {
  const view = renderGameViewer(world(), { inGameplay: <Probe />, initialTraits: ['brave', 'cursed'] });
  await screen.findByPlaceholderText(/Type your action/);
  const state = { ...live!.saveCurrentGameState(), fullMessageHistory: undefined, metEntities: ['keeper'], locationId: 'harbor' };
  view.unmount();
  cleanup();
  // A save record with only the fields a load reads.
  await putSaveRecord({ id: 'met', name: 'met', version: '3.0.1', currentState: state, stateHistory: [] } as unknown as SaveRecord);
  renderGameViewer(world(), { inGameplay: <Probe />, initialSaveId: 'met' });
  await waitFor(() => expect(helpWorld.get()?.snapshot().world.entities.map((e) => e.id)).toContain('keeper'));
  return helpWorld.get()!;
}

describe('the game registers the Player View for Formaquestion', () => {
  it('gives a Tool nothing for an unmet entity or place', async () => {
    const snapshot = (await openGame()).snapshot();
    expect(await runToolCall(GET_ENTITY, '{"name": "Velka Thorn"}', snapshot)).toEqual({ text: GET_ENTITY.emptyResult });
    expect(snapshot.world.locations.map((l) => l.id)).not.toContain('vault');
  });

  it('gives a Tool the player description, never the AI description or an unseen alias', async () => {
    const snapshot = (await openGame()).snapshot();
    const found = await runToolCall(GET_ENTITY, '{"name": "Odd Wick"}', snapshot);
    expect(found.text).toContain('The lamp-keeper.');
    expect(JSON.stringify(snapshot.world)).not.toMatch(/smuggl|heir/i);
    expect(await runToolCall(GET_ENTITY, '{"name": "The Smuggler King"}', snapshot)).toEqual({ text: GET_ENTITY.emptyResult });
  });

  it("keeps hidden and disabled stats out of a Tool's script state", async () => {
    const { state } = (await openGame()).snapshot().script;
    expect(state?.stats.map((s) => s.id)).toEqual(['Coins']);
    expect(Object.keys(state?.enabled ?? {})).toEqual(['Coins']);
    expect(state?.ownerTraits.world.traits.map((t) => t.id)).toEqual(['brave']);
    expect(state?.places?.locations.map((l) => l.id)).not.toContain('vault');
  });

  it("keeps unmet entities and hidden stats and traits out of the code test's names", async () => {
    const authored = (await openGame()).authored();
    const names = statCodeNames(authored);
    expect(JSON.stringify(names)).not.toMatch(/Suspicion|Frozen|Cursed|Velka|Vault/);
    expect(authored.entities.map((e) => e.id)).toEqual(['keeper']);
    expect(authored.stats.map((s) => s.id)).toEqual(['Coins']);
    expect(authored.traits.map((t) => t.id)).toEqual(['brave']);
  });

  it('reports a hidden stat to the code test as one the world does not have', async () => {
    const run = createCodeTest((await openGame()).authored);
    const result = await run(HELP_CODE_TEST, JSON.stringify({ code: 'stats.Suspicion.value = 1;', timing: 'after', owner: 'world' }));
    const report = JSON.parse(result.text) as { notInWorld: { name: string }[] };
    expect(report.notInWorld.map((missing) => missing.name)).toContain('Suspicion');
  });
});
