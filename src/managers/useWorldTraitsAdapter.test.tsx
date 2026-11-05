import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { panelWorld } from '@/test/panelBench';
import { renderTraitsTab } from '@/test/traitsTabBench';
import type { World } from '@/types';

/**
 * The top-level Traits tab on the List Editor: its flat search over world traits, owned traits and Links, and
 * the World Editor holding one selection per tab.
 */

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
  stats: [
    { id: 's-warmth', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] },
    { id: 's-damp', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
  ],
  traitGroups: [
    { id: 'g-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
    { id: 'g-classes', name: 'Classes', parentId: 'g-blueprints', order: 0 },
  ],
  traits: [
    { id: 't-paladin', name: 'Paladin', statChanges: [], groupId: 'g-classes' },
    { id: 't-tamer', name: 'Beast Tamer', statChanges: [], groupId: 'g-blueprints', order: 1 },
    // One Bench finding: a pin naming a placeholder that doesn't exist.
    { id: 't-oath', name: 'Hollow Oath', statChanges: [], order: 2, placeholderPins: [{ placeholderId: 'gone', value: 'ash' }] },
  ],
  entities: [
    {
      id: 'ash', name: 'Ash', persona: true, playerDescription: 'A wolf.', aiDescription: 'A wolf.', locations: ['harbor'],
      traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null }],
      traits: [{ id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [] }],
    },
    {
      id: 'rook', name: 'Rook', playerDescription: 'A ranger.', aiDescription: 'A ranger.', locations: ['harbor'],
      traitLinks: [
        { id: 'l-tamer', originalId: 't-tamer', kind: 'trait', originalName: 'Beast Tamer', groupId: null, order: 0 },
        { id: 'l-classes', originalId: 'g-classes', kind: 'group', originalName: 'Classes', groupId: null, order: 1 },
      ],
    },
  ],
} as Partial<World>);

const searchTraits = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Filter Traits'), { target: { value: term } });

/** The flat search list's rows, by the label each one shows. */
const searchRows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));

const searchRow = (label: string) => screen.getByRole('button', { name: `Select ${label}` }).parentElement as HTMLElement;

/** The open detail's Name field, which every trait and stat panel leads with. */
const shownName = () => {
  const field = screen.getByLabelText('Name');
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

beforeEach(() => { localStorage.clear(); });

describe('the Traits tab search', () => {
  it('lists world traits bare and owned traits and Links under their owner, as flat rows', () => {
    renderTraitsTab(WORLD, 'advanced');

    searchTraits('Tame');
    expect(searchRows()).toEqual(['Beast Tamer', 'Ash › Tamed', 'Rook › Beast Tamer']);
  });

  it('leaves groups and entity nodes out, a group Link included only as its own row', () => {
    renderTraitsTab(WORLD, 'advanced');

    searchTraits('Bond');
    expect(searchRows()).toEqual([]);
    expect(screen.getByText(/No traits match/)).toBeInTheDocument();

    searchTraits('Classes');
    expect(searchRows()).toEqual(['Rook › Classes']);

    // The owner's name finds its traits and Links, never its node.
    searchTraits('Rook');
    expect(searchRows()).toEqual(['Rook › Beast Tamer', 'Rook › Classes']);
  });

  it('opens an owned trait and a Link from their search rows', () => {
    renderTraitsTab(WORLD, 'advanced');

    searchTraits('Tamed');
    fireEvent.click(screen.getByRole('button', { name: 'Select Ash › Tamed' }));
    expect(shownName()).toBe('Tamed');

    searchTraits('Tamer');
    fireEvent.click(screen.getByRole('button', { name: 'Select Rook › Beast Tamer' }));
    expect(screen.getByRole('button', { name: 'Reset to Blueprint' })).toBeInTheDocument();
  });

  it('keeps the drag grip on world trait rows only', () => {
    renderTraitsTab(WORLD, 'advanced');

    searchTraits('Tame');
    expect(within(searchRow('Beast Tamer')).queryByLabelText('Drag to reorder')).not.toBeNull();
    expect(within(searchRow('Ash › Tamed')).queryByLabelText('Drag to reorder')).toBeNull();
    expect(within(searchRow('Rook › Beast Tamer')).queryByLabelText('Drag to reorder')).toBeNull();
  });

  it('removes an owned trait from its search row', () => {
    const { ctx } = renderTraitsTab(WORLD, 'advanced');

    searchTraits('Tamed');
    fireEvent.click(within(searchRow('Ash › Tamed')).getByRole('button', { name: 'Delete' }));
    expect(ctx().entities.find((e) => e.id === 'ash')!.traits ?? []).toEqual([]);
  });
});
