import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The top-level Entities tab on the List Editor: the folder tree, a flat sortable search, and the panels. */

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

const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e-wick', name: 'Odd Wick', locations: ['harbor'], groupId: null, order: 0 },
    { id: 'e-wren', name: 'Wren', locations: ['harbor'], groupId: null, order: 1 },
    {
      id: 'e-you', name: 'Wanderer', customPersona: true, groupId: null, order: 2,
      traits: [{ id: 't-grit', name: 'Grit', statChanges: [], groupId: null, order: 0 }],
    },
  ],
  entityGroups: [{ id: 'g-crew', name: 'Crew', parentId: null, order: 3 }],
} as Partial<World>);

const search = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Search or add new entities'), { target: { value: term } });

const row = (name: string) => screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;

const shownName = () => {
  const field = screen.queryByLabelText('Name');
  if (!field) return null;
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

beforeEach(() => { localStorage.clear(); });

describe('the Entities tab search rows', () => {
  it('draws a grip on every matching entity and leaves folders out', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);

    search('w');
    expect(within(row('Odd Wick')).queryByLabelText('Drag to reorder')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Crew' })).toBeNull();
  });

  it('duplicates an entity and opens the copy', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);

    search('Wick');
    fireEvent.click(within(row('Odd Wick')).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().entities.filter((e) => e.name === 'Odd Wick (Copy)')).toHaveLength(1);
    expect(shownName()).toBe('Odd Wick (Copy)');
  });

  it('asks before it deletes the Custom Persona entity, and closes its panel', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);

    search('Wanderer');
    fireEvent.click(screen.getByText('Wanderer'));
    fireEvent.click(within(row('Wanderer')).getByRole('button', { name: 'Delete' }));
    expect(shownName()).toBeNull();
    expect(ctx().entities.some((e) => e.id === 'e-you')).toBe(true);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(ctx().entities.some((e) => e.id === 'e-you')).toBe(false);
  });
});

describe('the Entities tab selection', () => {
  it('reopens the entity after a trip to another tab', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(screen.getByText('Wren'));

    openEditorTab(/Stats/);
    openEditorTab(/Entities/);
    expect(shownName()).toBe('Wren');
  });

  it('opens a folder\'s panel from the tree', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);

    fireEvent.click(screen.getByText('Crew'));
    expect(screen.getByText('Group Name')).toBeInTheDocument();
  });
});
