// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCommunityBrowserFilters, type CommunityBrowserFilterOptions } from './useCommunityBrowserFilters';
import { type WorldRecord } from '@/components/WorldDetails';

const day = (n: number) => new Date(Date.UTC(2026, 2, n)).toISOString();

// Twenty worlds whose four sort fields disagree, so each sort puts the gems somewhere else. Every row
// shares the author, tag and model a filter test picks, so a filter keeps the gems in the result.
const world = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `w${n}`, name: `World ${n}`, kind: 'world',
  updated_at: day(n), created_at: day(21 - n),
  downloads: (n * 7) % 20, likes: (n * 3) % 11,
  author: { id: 'pat', username: 'Pat' }, tags: ['common'], models: ['m1'],
  ...extra,
});
const GEMS = ['w4', 'w11', 'w17'];
const catalog = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  if (n === 11) return world(n, { hidden_gem: true, author: { id: 'ann', username: 'Ann' }, tags: ['common', 'quiet'] });
  return world(n, GEMS.includes(`w${n}`) ? { hidden_gem: true } : {});
}) as unknown as WorldRecord[];

// The default sort, newest update first.
const DEFAULT_ORDER = Array.from({ length: 20 }, (_, i) => `w${20 - i}`);

const ids = (rows: WorldRecord[]) => rows.map((w) => String(w.id));

const render = (rows: WorldRecord[] = catalog, options: CommunityBrowserFilterOptions = { tab: 'world' }) =>
  renderHook(() => useCommunityBrowserFilters(rows, () => 'none', true, options));

/** The plain sorted order, read from the hook with gems turned off. */
const plainOrder = (setup: (r: ReturnType<typeof useCommunityBrowserFilters>) => void = () => {}) => {
  const { result, unmount } = render();
  act(() => { result.current.setShowHiddenGems(false); setup(result.current); });
  const out = ids(result.current.filteredRemoteWorlds);
  unmount();
  localStorage.clear();
  return out;
};

/** A row's place in `order` without the moved rows, to check the sort holds around them. */
const without = (order: string[], moved: string[]) => order.filter((id) => !moved.includes(id));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false, media: '', onchange: null, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
  })));
  vi.stubGlobal('innerWidth', 1024); // four columns, so twelve rows a page
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Hidden Gems placement', () => {
  it.each([
    ['updated_at', 'desc'], ['updated_at', 'asc'], ['created_at', 'desc'],
    ['downloads', 'desc'], ['downloads', 'asc'], ['likes', 'desc'], ['likes', 'asc'],
  ] as const)('puts the gems in slots 3, 6 and 9 under %s %s', (field, dir) => {
    const setup = (r: ReturnType<typeof useCommunityBrowserFilters>) => { r.setSortField(field); r.setSortOrder(dir); };
    const plain = plainOrder(setup);
    const { result } = render();
    act(() => setup(result.current));

    const placed = ids(result.current.filteredRemoteWorlds);
    const gemsInSortOrder = plain.filter((id) => GEMS.includes(id));
    expect([placed[2], placed[5], placed[8]]).toEqual(gemsInSortOrder);
    expect(result.current.hiddenGemIds).toEqual(gemsInSortOrder);
    expect(without(placed, GEMS)).toEqual(without(plain, GEMS));
  });

  it('shows each world once and keeps the page count', () => {
    const { result } = render();
    const pageCount = result.current.totalPages;
    const seen: string[] = [];
    for (let page = 1; page <= pageCount; page++) {
      act(() => result.current.setCurrentPage(page));
      seen.push(...ids(result.current.pagedRemoteWorlds));
    }

    expect(pageCount).toBe(2);
    expect(new Set(seen).size).toBe(20);
    expect(seen).toHaveLength(20);
  });

  it('gives page 2 no gem slots', () => {
    const plain = plainOrder();
    const { result } = render();
    act(() => result.current.setCurrentPage(2));

    expect(result.current.hiddenGemIds).toEqual([]);
    expect(ids(result.current.pagedRemoteWorlds)).toEqual(without(plain, GEMS).slice(9, 17));
  });

  it.each([
    ['a search', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.setSearchQuery('world')],
    ['an author filter', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.setAuthorFilter(['Pat', 'Ann'])],
    ['a tag filter', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.setTagFilter(['common'])],
    ['a model filter', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.setModelFilter(['m1'])],
    ['a status filter', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.setStatusFilter(['undownloaded'])],
  ])('gives the plain sorted list under %s', (_, narrow) => {
    const { result } = render();
    act(() => narrow(result.current));

    expect(result.current.filteredRemoteWorlds).toHaveLength(20);
    expect(ids(result.current.filteredRemoteWorlds)).toEqual(DEFAULT_ORDER);
    expect(result.current.hiddenGemIds).toEqual([]);
  });

  it('gives the plain sorted list with the toggle off', () => {
    const { result } = render();
    act(() => result.current.setShowHiddenGems(false));

    expect(result.current.hiddenGemIds).toEqual([]);
    expect(ids(result.current.filteredRemoteWorlds)).toEqual(DEFAULT_ORDER);
  });

  it('keeps the toggle across a reload, and reads an older saved setting as on', () => {
    const first = render();
    act(() => first.result.current.setShowHiddenGems(false));
    first.unmount();
    expect(render().result.current.showHiddenGems).toBe(false);

    const saved = JSON.parse(localStorage.getItem('FORMAMORPH_communityFilters') || '{}');
    delete saved.world.showHiddenGems;
    localStorage.setItem('FORMAMORPH_communityFilters', JSON.stringify(saved));
    const { result } = render();
    expect(result.current.showHiddenGems).toBe(true);
    expect(result.current.hiddenGemIds).toHaveLength(3);
  });

  it('goes to page 1 on a flip, and Clear filters leaves the toggle alone', () => {
    const { result } = render();
    act(() => result.current.setCurrentPage(2));
    act(() => result.current.setShowHiddenGems(false));
    expect(result.current.currentPage).toBe(1);

    act(() => { result.current.setTagFilter(['common']); });
    act(() => result.current.clearFilters());
    expect(result.current.tagFilter).toEqual([]);
    expect(result.current.showHiddenGems).toBe(false);
  });

  it.each([
    ['world', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.hideRemoteWorld('w4')],
    ['author', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.hideRemoteAuthor('Ann')],
    ['tag', (r: ReturnType<typeof useCommunityBrowserFilters>) => r.hideRemoteTag('quiet')],
  ])('drops a gem whose %s is hidden', (_, hide) => {
    const { result } = render();
    act(() => hide(result.current));

    expect(result.current.hiddenGemIds).toHaveLength(2);
    const placed = ids(result.current.filteredRemoteWorlds);
    expect([placed[2], placed[5]]).toEqual(result.current.hiddenGemIds);
    expect(placed).toHaveLength(19);
  });

  it('leaves the order to the Contest tab', () => {
    const contestOrder = (list: WorldRecord[]) => [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const { result } = render(catalog, { tab: 'contest', order: contestOrder });

    expect(result.current.hiddenGemIds).toEqual([]);
    expect(ids(result.current.filteredRemoteWorlds)).toEqual(ids(contestOrder(catalog)));
  });

  it('leaves the other kind tabs alone', () => {
    const entities = catalog.map((w) => ({ ...w, kind: 'entity' }));
    const { result } = render(entities, { tab: 'entity' });
    const order = ids(result.current.filteredRemoteWorlds);
    act(() => result.current.setShowHiddenGems(false));

    expect(result.current.hiddenGemIds).toEqual([]);
    expect(ids(result.current.filteredRemoteWorlds)).toEqual(order);
  });

  it('leaves a gem in its sorted place when its slot is past a short page', () => {
    vi.stubGlobal('innerWidth', 640); // two columns, so six rows a page
    const plain = plainOrder();
    const { result } = render();

    const placed = ids(result.current.filteredRemoteWorlds);
    const gemsInSortOrder = plain.filter((id) => GEMS.includes(id));
    expect(result.current.hiddenGemIds).toEqual(gemsInSortOrder.slice(0, 2));
    expect([placed[2], placed[5]]).toEqual(gemsInSortOrder.slice(0, 2));
    expect(placed.indexOf(gemsInSortOrder[2])).toBe(plain.indexOf(gemsInSortOrder[2]));
  });

  it('counts the slots after the staff-pinned rows', () => {
    const pinned = catalog.map((w) => (w.id === 'w1' || w.id === 'w2' ? { ...w, pinned_at: day(25) } : w));
    const { result } = render(pinned);

    const placed = ids(result.current.filteredRemoteWorlds);
    expect(placed.slice(0, 2).sort()).toEqual(['w1', 'w2']);
    expect([placed[4], placed[7], placed[10]]).toEqual(result.current.hiddenGemIds);
    expect(result.current.hiddenGemIds).toHaveLength(3);
  });
});
