import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, putSaveRecord } from '@/components/modals/dbUtils';
import { resolveAvatarLook, type LookStats } from '@/lib/avatarLook';
import type { ChatMessage, Entity, PlayerStat, SaveRecord, Trait, World } from '@/types';

/** The stats GameViewer hands the Avatars switch on and off under the traits in force, player and entity alike. */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });
vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const statOf = (id: string, over: Partial<PlayerStat> = {}): PlayerStat =>
  ({ id, name: id, type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [], ...over });

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const morphsOf = (look: LookStats) => resolveAvatarLook({ ...look, catalog: null }).morphs;

describe('the stats the Avatars read', () => {
  it("adds a player stat authored off once the player's trait switches it on", async () => {
    const bloat = statOf('bloat', { enabled: false, morphBindings: [{ name: 'Belly' }] });
    const swollen: Trait = { id: 'swollen', name: 'Swollen', statChanges: [], statToggles: [{ statId: 'bloat', enabled: true }] };
    const world: World = { ...harborWorld({ stats: [bloat] }), traits: [swollen] };
    renderGameViewer(world, { inGameplay: <Probe />, initialTraits: ['swollen'] });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(morphsOf(gameplay().playerLookStats)).toEqual({ Belly: 0.5 }));
  });

  it("leaves an entity stat its own trait switched off at rest", async () => {
    const cracks = statOf('cracks', { morphBindings: [{ name: 'Cracks' }] });
    const mend: Trait = { id: 'mend', name: 'Mend', statChanges: [], statToggles: [{ statId: 'cracks', enabled: false }] };
    const golem = { id: 'golem', name: 'Golem', locations: ['harbor'], stats: [cracks], traits: [mend] } as unknown as Entity;
    renderGameViewer(harborWorld({ entities: [golem] }), { inGameplay: <Probe />, initialOwnedTraits: { golem: ['mend'] } });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(gameplay().viewEntityStatEnabled.golem).toEqual({ cracks: false }));
    const look = { stats: gameplay().viewEntityStats.golem, authored: [cracks], enabled: gameplay().viewEntityStatEnabled.golem };
    expect(morphsOf(look)).toEqual({});
  });
});

const pins = (value: number): Trait['morphPins'] => [{ name: 'Ear Shape', value }];
const elf: Trait = { id: 'elf', name: 'Elf', statChanges: [], playerToggle: true, morphPins: pins(1) };
const human: Trait = { id: 'human', name: 'Human', statChanges: [], playerToggle: true, morphPins: pins(0) };
const ears = () => morphsOf(gameplay().playerLookStats)['Ear Shape'];

describe('the trait slider pins the Avatars read', () => {
  afterEach(async () => { await deleteSaveRecord('pins').catch(() => {}); });

  it("holds the player's slider while a chosen trait is active", async () => {
    renderGameViewer({ ...harborWorld(), traits: [elf] }, { inGameplay: <Probe />, initialTraits: ['elf'] });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(ears()).toBe(1));
    act(() => gameplay().setDisabledTraitIds(['elf']));
    await waitFor(() => expect(ears()).toBeUndefined());
  });

  it('shows the pin of an active trait a loaded save never listed in its switch-on order', async () => {
    const world: World = { ...harborWorld(), traits: [human, elf] };
    const view = renderGameViewer(world, { inGameplay: <Probe />, initialTraits: ['human', 'elf'] });
    await screen.findByPlaceholderText(/Type your action/);
    // The save lists only Human, and the loaded tree puts Human last; Elf still counts as switched on later.
    const state = { ...gameplay().saveCurrentGameState(), bodies: { traitsOn: [{ ownerId: null, traitId: 'human' }] } };
    view.unmount();
    cleanup();
    live = null;
    await putSaveRecord({ id: 'pins', name: 'pins', version: '3.0.1', currentState: state, stateHistory: [] } as unknown as SaveRecord);
    renderGameViewer({ ...world, traits: [elf, human] }, { inGameplay: <Probe />, initialSaveId: 'pins' });
    await waitFor(() => expect(live?.logEntries.some((e) => e.text.startsWith('Game loaded'))).toBe(true));
    await waitFor(() => expect(ears()).toBe(1));
  });

  it("shows the player's own value on a turn paged back to before the trait switched on", async () => {
    renderGameViewer({ ...harborWorld(), traits: [elf] }, { inGameplay: <Probe />, initialTraits: ['elf'] });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(ears()).toBe(1));
    const before = { ...gameplay().saveCurrentGameState(), globalTraits: [] };
    act(() => {
      const g = gameplay();
      const turn = (n: number) => [{ role: 'user', content: `go ${n}` }, { role: 'assistant', content: `went ${n}` }] as ChatMessage[];
      g.setFullMessageHistory([...turn(1), ...turn(2)]);
      g.setGameStates([before]);
      g.setUserPage(1);
    });
    await waitFor(() => expect(gameplay().isViewingPast).toBe(true));
    await waitFor(() => expect(ears()).toBeUndefined());
    act(() => gameplay().setUserPage(2));
    await waitFor(() => expect(ears()).toBe(1));
  });

  it('reads the switch-on order the paged-back turn kept', async () => {
    renderGameViewer({ ...harborWorld(), traits: [human, elf] }, { inGameplay: <Probe />, initialTraits: ['human', 'elf'] });
    await screen.findByPlaceholderText(/Type your action/);
    const on = (...ids: string[]) => ({ traitsOn: ids.map((traitId) => ({ ownerId: null, traitId })) });
    // Back then Elf switched on first, so Human won; now Human switched on first, so Elf wins.
    const before = { ...gameplay().saveCurrentGameState(), bodies: on('elf', 'human') };
    act(() => {
      const g = gameplay();
      const turn = (n: number) => [{ role: 'user', content: `go ${n}` }, { role: 'assistant', content: `went ${n}` }] as ChatMessage[];
      g.setBodies(on('human', 'elf'));
      g.setFullMessageHistory([...turn(1), ...turn(2)]);
      g.setGameStates([before]);
    });
    await waitFor(() => expect(ears()).toBe(1));
    act(() => gameplay().setUserPage(1));
    await waitFor(() => expect(ears()).toBe(0));
  });

  it("pins an entity's own model from its own trait", async () => {
    const pointy: Trait = { id: 'pointy', name: 'Pointy', statChanges: [], morphPins: pins(0.7) };
    const golem = { id: 'golem', name: 'Golem', locations: ['harbor'], traits: [pointy] } as unknown as Entity;
    renderGameViewer(harborWorld({ entities: [golem] }), { inGameplay: <Probe />, initialOwnedTraits: { golem: ['pointy'] } });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(gameplay().viewEntityLookTraits.golem).toBeDefined());
    const look = { stats: [], authored: [], traits: gameplay().viewEntityLookTraits.golem };
    expect(morphsOf(look)).toEqual({ 'Ear Shape': 0.7 });
    expect(ears()).toBeUndefined();
  });

  it("pins the played Persona from the played entity's own trait", async () => {
    const pointy: Trait = { id: 'pointy', name: 'Pointy', statChanges: [], playerToggle: true, morphPins: pins(0.7) };
    const ash: Entity = { id: 'ash', name: 'Ash', persona: true, personaOnly: true, traits: [pointy] };
    renderGameViewer(harborWorld({ entities: [ash] }), {
      inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ash' } }, initialOwnedTraits: { ash: ['pointy'] },
    });
    await screen.findByPlaceholderText(/Type your action/);
    await waitFor(() => expect(ears()).toBe(0.7));
    expect(gameplay().viewEntityLookTraits.ash).toBeUndefined();
  });
});
