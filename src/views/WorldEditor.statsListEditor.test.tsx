import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { asMobile, benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** The top-level Stats tab on the List Editor: one flat, sortable list with search, a single +, and row actions. */

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

const stat = (id: string, name: string) =>
  ({ id, name, type: 'number' as const, description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] });

const WORLD: World = benchEditorWorld({
  stats: [stat('s-warmth', 'Warmth'), stat('s-damp', 'Damp'), stat('s-dread', 'Dread')],
} as Partial<World>);

const searchStats = (term: string) =>
  fireEvent.change(screen.getByPlaceholderText('Search or add new stats'), { target: { value: term } });

const rows = () => screen.queryAllByRole('button', { name: /^Select / }).map((b) => b.getAttribute('aria-label')!.slice('Select '.length));

const row = (name: string) => screen.getByRole('button', { name: `Select ${name}` }).parentElement as HTMLElement;

const shownName = () => {
  const field = screen.queryByLabelText('Name');
  if (!field) return null;
  return field instanceof HTMLInputElement ? field.value : field.textContent;
};

const detailPushed = () => document.querySelector('[data-list-detail] > [aria-hidden]')?.getAttribute('aria-hidden') === 'false';

beforeEach(() => { localStorage.clear(); });

describe('the Stats tab', () => {
  it('lists every stat in world order, each with a drag grip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);

    expect(rows()).toEqual(['Warmth', 'Damp', 'Dread']);
    expect(within(row('Damp')).queryByLabelText('Drag to reorder')).not.toBeNull();
  });

  it('shows the empty hint on a world with no stats', () => {
    renderWorldEditorBench(benchEditorWorld({ stats: [] } as Partial<World>), 'advanced');
    openEditorTab(/Stats/);

    expect(screen.getByText(/No stats yet/)).toBeInTheDocument();
  });

  it('filters by name and names a search with no match', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);

    searchStats('D');
    expect(rows()).toEqual(['Damp', 'Dread']);
    searchStats('Hunger');
    expect(rows()).toEqual([]);
    expect(screen.getByText(/No stats match/)).toBeInTheDocument();
  });

  it('opens a stat\'s details from its row', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);

    fireEvent.click(screen.getByText('Damp'));
    expect(shownName()).toBe('Damp');
  });

  it('adds a stat named from the search box and opens it', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);

    searchStats('Hunger');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Stats' }));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Damp', 'Dread', 'Hunger']);
    expect(shownName()).toBe('Hunger');
  });

  it('duplicates a stat right after the original and opens the copy', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);

    fireEvent.click(within(row('Warmth')).getByRole('button', { name: 'Duplicate' }));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Warmth (Copy)', 'Damp', 'Dread']);
    expect(ctx().stats[1].id).not.toBe('s-warmth');
    expect(shownName()).toBe('Warmth (Copy)');
  });

  it('deletes a stat and closes its details', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);

    fireEvent.click(screen.getByText('Damp'));
    fireEvent.click(within(row('Damp')).getByRole('button', { name: 'Delete' }));
    expect(ctx().stats.map((s) => s.name)).toEqual(['Warmth', 'Dread']);
    expect(shownName()).toBeNull();
  });

  // Drift log #2: kept until ruled.
  it('blanks the open stat\'s details while a search leaves it out', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Stats/);

    fireEvent.click(screen.getByText('Damp'));
    searchStats('Warm');
    expect(shownName()).toBeNull();
    searchStats('');
    expect(shownName()).toBe('Damp');
  });

  describe('on mobile', () => {
    let restore: () => void;
    beforeEach(() => { restore = asMobile(); });
    afterEach(() => restore());

    it('pushes the details over the list and goes back to it', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(/Stats/);

      fireEvent.click(screen.getByText('Damp'));
      expect(detailPushed()).toBe(true);
      expect(shownName()).toBe('Damp');
      fireEvent.click(screen.getByRole('button', { name: 'Back to Stats' }));
      expect(detailPushed()).toBe(false);
    });
  });
});
