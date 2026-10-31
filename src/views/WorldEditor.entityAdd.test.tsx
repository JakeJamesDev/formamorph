import { describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench, shownEditorTab } from '@/test/worldEditorBench';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import type { Entity, World } from '@/types';

/** The World Editor's side of an entity card's Add: a blank entity at the root, shown on the Entities tab, undone by undo. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const grouped: Entity = { id: 'grouped', name: 'Grouped', playerDescription: '', aiDescription: '', groupId: 'g1', order: 0 };
const WORLD: World = benchEditorWorld({
  entities: [...benchEditorWorld({}).entities, grouped],
  entityGroups: [{ id: 'g1', name: 'Folk', parentId: null, order: 1 }],
} as Partial<World>);

const DRAFT = { name: 'Maren Holt', aiDescription: 'A gate guard who knows every face in town.' };

async function addFromCard(props: { inGame?: boolean } = {}) {
  const bench = renderWorldEditorBench(WORLD, 'simple', props);
  await waitFor(() => expect(helpWorld.get()?.lean).toBe('editor'));
  act(() => helpWorld.get()!.addEntity!(DRAFT));
  const added = bench.ctx().entities.find((entity) => entity.name === DRAFT.name)!;
  return { bench, added };
}

describe("an entity card's Add in the World Editor", () => {
  it('adds a blank entity at the root with the draft name and AI description', async () => {
    const { bench, added } = await addFromCard();
    const blank: Partial<Entity> = { playerDescription: '', aiSummary: '', type: '', groupId: null };
    expect(added).toMatchObject({ ...blank, ...DRAFT });
    // After the root's ungrouped entities and its one group.
    const rootEntities = WORLD.entities.filter((entity) => !entity.groupId).length;
    expect(added.order).toBe(rootEntities + 1);
    expect(bench.ctx().entities).toHaveLength(WORLD.entities.length + 1);
  });

  it('opens the Entities tab and selects the new entity', async () => {
    await addFromCard();
    expect(shownEditorTab()).toMatch(/Entities/);
    const selected = [...document.querySelectorAll<HTMLElement>('[data-editor-row-selected]')];
    expect(selected.map((row) => row.textContent)).toEqual([expect.stringContaining(DRAFT.name)]);
  });

  it('is undone by undo', async () => {
    const { bench } = await addFromCard();
    act(() => bench.history().undo());
    expect(bench.ctx().entities.map((entity) => entity.name)).not.toContain(DRAFT.name);
    expect(bench.ctx().entities).toHaveLength(WORLD.entities.length);
  });

  it('works in the in-game World Editor', async () => {
    const { bench } = await addFromCard({ inGame: true });
    expect(bench.ctx().entities.map((entity) => entity.name)).toContain(DRAFT.name);
  });
});
