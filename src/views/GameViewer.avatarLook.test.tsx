import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { resolveAvatarLook, type LookStats } from '@/lib/avatarLook';
import type { Entity, PlayerStat, Trait, World } from '@/types';

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
