import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCommunityBrowserFilters } from './useCommunityBrowserFilters';
import { type WorldRecord } from '@/components/WorldDetails';

/**
 * Sorting the catalog by likes.
 *
 * The browser pulls the whole catalog in one request with no server sort, so this client comparator *is*
 * what sorting means in Community Creations — a `likes` option the server understands and this does not
 * would silently leave the grid in date order.
 */

// Dates run opposite to likes on purpose: a `likes` sort that fell through to the date branch would give
// the reverse of what these expect rather than agreeing by luck.
const catalog: WorldRecord[] = [
  { id: 'quiet', name: 'Quiet', kind: 'world', likes: 0, downloads: 90, updated_at: '2026-03-03T00:00:00.000Z', tags: [] },
  { id: 'liked', name: 'Liked', kind: 'world', likes: 5, downloads: 10, updated_at: '2026-03-02T00:00:00.000Z', tags: [] },
  { id: 'loved', name: 'Loved', kind: 'world', likes: 9, downloads: 50, updated_at: '2026-03-01T00:00:00.000Z', tags: [] },
] as unknown as WorldRecord[];

const order = (field: string, direction: 'asc' | 'desc', rows = catalog) => {
  const { result } = renderHook(() => useCommunityBrowserFilters(rows, () => 'none', true, 'world'));
  act(() => {
    result.current.setSortField(field);
    result.current.setSortOrder(direction);
    // Otherwise a listing with an update available floats regardless of the sort under test.
    result.current.setSortUpdatesFirst(false);
  });

  return result.current.filteredRemoteWorlds.map((w) => w.name);
};

// The hook sizes its pages off the viewport; jsdom has no matchMedia. Mirrors useIsMobile.test.tsx.
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('sorting by likes', () => {
  it('puts the most liked first', () => {
    expect(order('likes', 'desc')).toEqual(['Loved', 'Liked', 'Quiet']);
  });

  it('reverses when asked', () => {
    expect(order('likes', 'asc')).toEqual(['Quiet', 'Liked', 'Loved']);
  });

  it('treats a missing count as none rather than dropping the row', () => {
    const rows = [
      { id: 'none', name: 'Unliked', kind: 'world', updated_at: '2026-03-04T00:00:00.000Z', tags: [] },
      ...catalog,
    ] as unknown as WorldRecord[];

    const names = order('likes', 'desc', rows);

    // It sorts as a zero rather than falling out or floating: it lands among the unliked, and its newer
    // date does not carry it up the list.
    expect(names.slice(0, 2)).toEqual(['Loved', 'Liked']);
    expect(names.slice(2).sort()).toEqual(['Quiet', 'Unliked']);
  });

  it('leaves the download sort alone', () => {
    // The two counts share a branch; one must not start reading the other's field.
    expect(order('downloads', 'desc')).toEqual(['Quiet', 'Loved', 'Liked']);
  });

  it('still sorts by date when asked for one', () => {
    expect(order('updated_at', 'desc')).toEqual(['Quiet', 'Liked', 'Loved']);
  });
});
