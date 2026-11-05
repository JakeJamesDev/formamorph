import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { panelWorld } from '@/test/panelBench';
import { renderTraitsTab } from '@/test/traitsTabBench';
import type { World } from '@/types';

/** Entity nodes on the Traits tab: an entity that owns traits shows as a node, and its rows edit on the entity. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const WORLD: World = panelWorld({
  entities: [
    { id: 'wick', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    {
      id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
      traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null, maxPicks: 2 }],
      traits: [
        { id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [] },
        { id: 't-wild', name: 'Wild', groupId: 'g-bond', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 't-paladin' }] }] },
      ],
    },
  ],
  traits: [
    { id: 't-paladin', name: 'Paladin', statChanges: [] },
    { id: 't-tamer', name: 'Beast Tamer', statChanges: [] },
  ],
} as Partial<World>);

/** A tree row found by its drag grip, so the panel's own copy of the name never matches. */
const treeRow = (name: string) => screen.getAllByLabelText('Drag to reorder or nest')
  .map((grip) => grip.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name));

/** An entity node row, found by its chevron, which names it an entity rather than a group. */
const entityNodeRow = (name: string) => screen.queryAllByRole('button', { name: /(Collapse|Expand) entity/ })
  .map((chevron) => chevron.parentElement as HTMLElement)
  .find((row) => within(row).queryByText(name));

const entity = (ctx: () => { entities: World['entities'] }, id: string) => ctx().entities.find((e) => e.id === id)!;

beforeEach(() => { localStorage.clear(); });

describe('entity nodes on the Traits tab', () => {
  it('shows a node with a user icon for each entity that owns a trait, and none for one that owns nothing', () => {
    renderTraitsTab(WORLD, 'advanced');
    const node = entityNodeRow('Ash')!;
    expect(node).toHaveTextContent(/AshPlayable$/);
    expect(node.querySelector('.lucide-user')).not.toBeNull();
    expect(node.querySelector('.lucide-folder')).toBeNull();
    expect(entityNodeRow('Odd Wick')).toBeUndefined();
  });

  it('gives a node a drag grip, and no delete or duplicate', () => {
    renderTraitsTab(WORLD, 'advanced');
    const node = entityNodeRow('Ash')!;
    expect(within(node).getByLabelText('Drag to reorder or nest')).toBeInTheDocument();
    expect(within(node).queryByTitle('Delete')).toBeNull();
    expect(within(node).queryByTitle('Duplicate')).toBeNull();
  });

  it('keeps the node while the entity owns a group, and drops it once it owns nothing', () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    for (const name of ['Tamed', 'Wild']) {
      fireEvent.click(within(treeRow(name)!).getByRole('button', { name: 'Delete' }));
    }
    expect(entity(ctx, 'ash').traits).toBeUndefined();
    expect(entityNodeRow('Ash')).toBeDefined();
    fireEvent.click(within(treeRow('Bond')!).getByRole('button', { name: 'Delete' }));
    expect(entity(ctx, 'ash').traitGroups).toBeUndefined();
    expect(entityNodeRow('Ash')).toBeUndefined();
  });

  it('edits an owned group like a world one, writing to its entity', () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');
    fireEvent.click(treeRow('Bond')!);
    // A max of 2 matches no preset, so the count fields show without opening the select.
    fireEvent.change(screen.getByLabelText('At Most'), { target: { value: '1' } });
    expect(entity(ctx, 'ash').traitGroups).toEqual([expect.objectContaining({ id: 'g-bond', maxPicks: 1 })]);
    expect(ctx().traitGroups).toEqual([]);
  });
});
