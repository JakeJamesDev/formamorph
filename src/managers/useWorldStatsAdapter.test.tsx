import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { panelWorld } from '@/test/panelBench';
import { renderStatsTab } from '@/test/statsTabBench';
import type { World } from '@/types';

/** The top-level Stats tab on the List Editor: the stat folder tree, a flat search over its stats, a + menu, and row actions. */

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

const stat = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, type: 'number' as const, description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra });

const WORLD: World = panelWorld({
  stats: [stat('s-warmth', 'Warmth'), stat('s-damp', 'Damp'), stat('s-dread', 'Dread')],
} as Partial<World>);

const searchStats = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Filter Stats'), { target: { value: term } });

/** The search list's rows: a labeled select button each, which the tree's rows do not have. */
const searchRows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));
const searchRow = (name: string) => screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;

/** The tree's rows, found by their drag grips so the panel's own copy of a name never matches. */
const treeRows = () => screen.queryAllByLabelText('Drag to reorder or nest').map((grip) => grip.parentElement as HTMLElement);
const rows = () => treeRows().map((r) => r.textContent!);
const row = (name: string) => treeRows().find((r) => within(r).queryByText(name, { exact: true }))!;

const shownName = () => {
  const field = screen.queryByLabelText('Name');
  if (!field) return null;
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

beforeEach(() => { localStorage.clear(); });

describe('the Stats tab', () => {
  it('lists every stat in world order, each with a drag grip', () => {
    renderStatsTab(WORLD, 'advanced');

    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
    expect(within(row('Damp')).queryByLabelText('Drag to reorder or nest')).not.toBeNull();
  });

  it('shows the empty hint on a world with no stats', () => {
    renderStatsTab(panelWorld({ stats: [] } as Partial<World>), 'advanced');

    expect(screen.getByText(/No stats yet/)).toBeInTheDocument();
  });

  it('filters by name and names a search with no match', () => {
    renderStatsTab(WORLD, 'advanced');

    searchStats('D');
    expect(searchRows()).toEqual(['Damp', 'Dread']);
    searchStats('Hunger');
    expect(searchRows()).toEqual([]);
    expect(screen.getByText(/No stats match/)).toBeInTheDocument();
  });

  it('opens a stat\'s details from its row', () => {
    renderStatsTab(WORLD, 'advanced');

    fireEvent.click(screen.getByText('Damp'));
    expect(shownName()).toBe('Damp');
  });

  it('adds a stat named from the search box and opens it', () => {
    const { ctx } = renderStatsTab(WORLD, 'advanced');

    searchStats('Hunger');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Damp', 'Dread', 'Hunger']);
    expect(ctx().stats[3]).toMatchObject({ groupId: null, order: 3 });
    expect(shownName()).toBe('Hunger');
  });

  it('adds a stat in one click in Basic, where the tab has no groups', () => {
    const { ctx } = renderStatsTab(WORLD, 'simple');

    fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
    expect(screen.queryByRole('button', { name: 'Add Group' })).toBeNull();
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Damp', 'Dread', 'New Stat']);
  });

  it('draws no grip on the search rows, since the tree alone changes the order', () => {
    renderStatsTab(WORLD, 'advanced');

    searchStats('D');
    expect(within(searchRow('Damp')).queryByLabelText(/Drag to reorder/)).toBeNull();
  });

  it('duplicates a stat right after the original and opens the copy', () => {
    const { ctx } = renderStatsTab(WORLD, 'advanced');

    fireEvent.click(within(row('Warmth')).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Warmth (Copy)', 'Damp', 'Dread']);
    expect(ctx().stats[1].id).not.toBe('s-warmth');
    expect(shownName()).toBe('Warmth (Copy)');
  });

  it('deletes a stat and closes its details', () => {
    const { ctx } = renderStatsTab(WORLD, 'advanced');

    fireEvent.click(screen.getByText('Damp'));
    fireEvent.click(within(row('Damp')).getByRole('button', { name: 'Delete' }));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Dread']);
    expect(shownName()).toBeNull();
  });

  describe('stat groups', () => {
    const GROUPED: World = panelWorld({
      stats: [
        stat('s-warmth', 'Warmth', { groupId: 'g-body', order: 0 }),
        stat('s-damp', 'Damp', { groupId: null, order: 1 }),
        stat('s-dread', 'Dread', { groupId: 'g-mind', order: 0 }),
      ],
      statGroups: [
        { id: 'g-body', name: 'Body', parentId: null, order: 0, aiDescription: 'What the body can take.' },
        { id: 'g-mind', name: 'Mind', parentId: null, order: 2 },
      ],
    } as Partial<World>);

    it('draws each group over the stats it holds, in tree order', () => {
      renderStatsTab(GROUPED, 'advanced');

      expect(rows()).toEqual(['Body', 'Warmth', 'Damp', 'Mind', 'Dread']);
    });

    it('hides the stats of a collapsed group', () => {
      renderStatsTab(GROUPED, 'advanced');

      fireEvent.click(within(row('Body')).getByRole('button', { name: 'Collapse group' }));
      expect(rows()).toEqual(['Body', 'Damp', 'Mind', 'Dread']);
    });

    it('adds a group at the top level from the + menu and opens its panel, with no pick counts', () => {
      const { ctx } = renderStatsTab(GROUPED, 'advanced');

      fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
      expect(ctx().statGroups).toHaveLength(3);
      expect(ctx().statGroups?.[2]).toMatchObject({ name: 'New Group', parentId: null, order: 3 });
      expect(screen.getByLabelText('Group Name')).toBeInTheDocument();
      expect(screen.getByText('AI-Facing Description')).toBeInTheDocument();
      expect(screen.queryByText('Pick Count')).toBeNull();
    });

    it('names a new group from the search box', () => {
      const { ctx } = renderStatsTab(GROUPED, 'advanced');

      searchStats('Needs');
      fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add Group' }));
      expect(ctx().statGroups?.map((g) => g.name)).toEqual(['Body', 'Mind', 'Needs']);
    });

    it('opens the panel of a group from its row', () => {
      renderStatsTab(GROUPED, 'advanced');

      fireEvent.click(screen.getByText('Body'));
      expect(screen.getByLabelText('Group Name')).toHaveTextContent('Body');
      expect(screen.getByText('AI-Facing Description')).toBeInTheDocument();
    });

    it('deletes a group and moves its stats up a level', () => {
      const { ctx } = renderStatsTab(GROUPED, 'advanced');

      fireEvent.click(within(row('Body')).getByRole('button', { name: 'Delete' }));
      expect(ctx().statGroups?.map((g) => g.id)).toEqual(['g-mind']);
      expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Damp', 'Dread']);
      expect(ctx().stats.find((s) => s.id === 's-warmth')?.groupId).toBeNull();
      expect(rows()).toContain('Warmth');
    });

    it('duplicates a group with the stats in it', () => {
      const { ctx } = renderStatsTab(GROUPED, 'advanced');

      fireEvent.click(within(row('Body')).getByRole('button', { name: 'Duplicate' }));
      const copy = ctx().statGroups?.find((g) => g.name === 'Body (Copy)');
      expect(copy).toBeDefined();
      // Only the copied group takes the suffix; its stat is a new stat under a fresh id.
      const held = ctx().stats.filter((s) => s.groupId === copy!.id);
      expect(held.map((s) => s.name)).toEqual(['Warmth']);
      expect(held[0].id).not.toBe('s-warmth');
      // The original keeps its own stat.
      expect(ctx().stats.filter((s) => s.groupId === 'g-body').map((s) => s.id)).toEqual(['s-warmth']);
    });

    it('keeps a stat in the group a search opens it from', () => {
      renderStatsTab(GROUPED, 'advanced');

      searchStats('Warm');
      fireEvent.click(screen.getByText('Warmth'));
      expect(shownName()).toBe('Warmth');
    });
  });
});
