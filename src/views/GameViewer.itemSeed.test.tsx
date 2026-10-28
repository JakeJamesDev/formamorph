import { cleanup, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { harborWorld, renderGameViewer } from '@/test/gameViewer';
import { useGameplay } from '@/contexts/GameplayContext';
import { deleteSaveRecord, getAllSaveRecords, putSaveRecord } from '@/components/modals/dbUtils';
import type { Entity, GameState, Item, ItemCopy, Placement, SaveRecord, World } from '@/types';

/** Starting items on a mounted game: a new game seeds them, a loaded save never gains any (Q59, Q60). */

vi.hoisted(() => { vi.stubEnv('VITE_DEFAULT_ENDPOINT', ''); });

vi.mock('@/views/VRMViewer', () => import('@/test/stubs/vrmViewer'));
vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), warn: vi.fn(), dismiss: vi.fn(), isActive: vi.fn() }),
  ToastContainer: () => null,
}));

const lantern: Item = { id: 'lantern', name: 'Lantern', statEffects: [], traitEffects: [], equipRequires: [] };
const oar: Item = { id: 'oar', name: 'Oar', stackable: false, statEffects: [], traitEffects: [], equipRequires: [] };
const ferryman: Entity = { id: 'ferryman', name: 'Ferryman', persona: true, locations: ['harbor'] };
const placements: Placement[] = [
  { id: 'p-you', where: { kind: 'you' }, quantity: 1, source: { kind: 'item', itemId: 'lantern' } },
  { id: 'p-ferry', where: { kind: 'entity', id: 'ferryman' }, quantity: 2, source: { kind: 'item', itemId: 'lantern' } },
  { id: 'p-dock', where: { kind: 'location', id: 'harbor' }, quantity: 1, hidden: true, source: { kind: 'item', itemId: 'oar' } },
];

const worldWith = (over: Partial<World> = {}): World =>
  ({ ...harborWorld({ entities: [ferryman] }), items: [lantern, oar], ...over });

let live: ReturnType<typeof useGameplay> | null = null;
const Probe = () => { live = useGameplay(); return null; };
const gameplay = () => {
  if (!live) throw new Error('no gameplay yet');
  return live;
};
const summary = (copies: readonly ItemCopy[]) => copies.map(({ item, where, quantity, visibility }) => ({ item, where, quantity, visibility }));

beforeEach(async () => {
  for (const { id } of await getAllSaveRecords()) await deleteSaveRecord(id);
  live = null;
  localStorage.clear();
});

/** A save of `world` as a new game left it, written straight to storage. */
async function saveOf(world: World, over: Partial<GameState> = {}): Promise<string> {
  const view = renderGameViewer(world, { inGameplay: <Probe /> });
  await screen.findByPlaceholderText(/Type your action/);
  const state = { ...gameplay().saveCurrentGameState(), fullMessageHistory: undefined, ...over };
  view.unmount();
  cleanup();
  await putSaveRecord({ id: 'older', name: 'older', version: '3.0.1', currentState: state, stateHistory: [] } as unknown as SaveRecord);
  return 'older';
}

describe('a new game', () => {
  it("starts with the seeded Item Copies, the played entity's on the player", async () => {
    renderGameViewer(worldWith({ placements }), {
      inGameplay: <Probe />, initialPersona: { ref: { source: 'world', entityId: 'ferryman' } },
    });
    await waitFor(() => expect(gameplay().itemCopies).toHaveLength(2));
    expect(summary(gameplay().itemCopies)).toEqual([
      { item: { kind: 'item', itemId: 'lantern' }, where: { kind: 'you' }, quantity: 3, visibility: 'visible' },
      { item: { kind: 'item', itemId: 'oar' }, where: { kind: 'location', id: 'harbor' }, quantity: 1, visibility: 'hidden' },
    ]);
  });
});

describe('a loaded save', () => {
  it('gains no Item Copies from placements the world added after it was written', async () => {
    const saveId = await saveOf(worldWith());
    renderGameViewer(worldWith({ placements }), { inGameplay: <Probe />, initialSaveId: saveId });
    await waitFor(() => expect(gameplay().logEntries.some((e) => e.text.startsWith('Game loaded'))).toBe(true));
    expect(gameplay().itemCopies).toEqual([]);
  });

  it('drops an Item Copy of an item the world deleted, with a log line', async () => {
    const kept: ItemCopy = { id: 'k', item: { kind: 'item', itemId: 'lantern' }, where: { kind: 'you' }, quantity: 1, visibility: 'visible' };
    const gone: ItemCopy = { ...kept, id: 'g', item: { kind: 'item', itemId: 'oar' } };
    const saveId = await saveOf(worldWith(), { itemCopies: [kept, gone] });
    renderGameViewer(worldWith({ items: [lantern] }), { inGameplay: <Probe />, initialSaveId: saveId });
    await waitFor(() => expect(gameplay().logEntries.some((e) => e.text.startsWith('Game loaded'))).toBe(true));
    expect(gameplay().itemCopies).toEqual([kept]);
    expect(gameplay().logEntries.map((e) => e.text)).toContain('Removed 1 item whose item, owner or location no longer exists');
  });
});
