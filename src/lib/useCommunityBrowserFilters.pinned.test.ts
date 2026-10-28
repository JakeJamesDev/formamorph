// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCommunityBrowserFilters } from './useCommunityBrowserFilters';
import { type WorldRecord } from '@/components/WorldDetails';

// Dates and likes run opposite to the pins, so a sort that ignored `pinned_at` would give the reverse.
const catalog = [
  { id: 'fresh', name: 'Fresh', kind: 'world', likes: 9, updated_at: '2026-03-09T00:00:00.000Z', tags: ['x'] },
  { id: 'old-pin', name: 'Old Pin', kind: 'world', likes: 0, updated_at: '2026-03-01T00:00:00.000Z', pinned_at: '2026-04-01T00:00:00.000Z', tags: ['x'] },
  { id: 'new-pin', name: 'New Pin', kind: 'world', likes: 1, updated_at: '2026-03-02T00:00:00.000Z', pinned_at: '2026-04-05T00:00:00.000Z', tags: [] },
  { id: 'mid', name: 'Mid', kind: 'world', likes: 5, updated_at: '2026-03-05T00:00:00.000Z', tags: [] },
  { id: 'dict-pin', name: 'Dict Pin', kind: 'dictionary', likes: 0, updated_at: '2026-01-01T00:00:00.000Z', pinned_at: '2026-04-09T00:00:00.000Z', tags: [] },
] as unknown as WorldRecord[];

const names = (setup: (r: ReturnType<typeof useCommunityBrowserFilters>) => void, update?: (id: string) => boolean) => {
  const { result } = renderHook(() =>
    useCommunityBrowserFilters(catalog, (w) => (update?.(String(w.id)) ? 'update' : 'none'), true, { tab: 'world' }));
  act(() => setup(result.current));

  return result.current.filteredRemoteWorlds.map((w) => w.name);
};

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false, media: '', onchange: null, addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('pinned listings', () => {
  it.each([
    ['updated_at', 'desc'], ['updated_at', 'asc'], ['likes', 'desc'], ['likes', 'asc'], ['downloads', 'asc'],
  ] as const)('lead the section under %s %s, newest pin first', (field, dir) => {
    const order = names((r) => { r.setSortField(field); r.setSortOrder(dir); r.setSortUpdatesFirst(false); });

    expect(order.slice(0, 2)).toEqual(['New Pin', 'Old Pin']);
  });

  it('lead even when another listing has an update waiting', () => {
    const order = names((r) => { r.setSortUpdatesFirst(true); }, (id) => id === 'fresh');

    expect(order).toEqual(['New Pin', 'Old Pin', 'Fresh', 'Mid']);
  });

  it('stay first under a filter, and stay within their own kind', () => {
    const order = names((r) => { r.setTagFilter(['x']); });

    expect(order).toEqual(['Old Pin', 'Fresh']);
  });
});
