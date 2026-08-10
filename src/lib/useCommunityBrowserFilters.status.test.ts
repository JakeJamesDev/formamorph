import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCommunityBrowserFilters } from './useCommunityBrowserFilters';
import { type DownloadState } from '@/lib/downloadState';
import { type WorldRecord } from '@/components/WorldDetails';

/**
 * The status facets, per-kind filter state, and the settings that survive a restart.
 *
 * These are the parts with no server behind them: the catalog arrives as one unfiltered request, so what
 * "Liked" means in Community Creations is entirely this pipeline.
 */

const ME = 'me-1';

const catalog: WorldRecord[] = [
  { id: 'a', name: 'Mine And Liked', kind: 'world', liked: true, author: { id: ME, username: 'Me' }, tags: [], updated_at: '2026-03-01T00:00:00.000Z' },
  { id: 'b', name: 'Liked', kind: 'world', liked: true, author: { id: 'x', username: 'Other' }, tags: [], updated_at: '2026-03-02T00:00:00.000Z' },
  { id: 'c', name: 'Plain', kind: 'world', author: { id: 'x', username: 'Other' }, tags: [], updated_at: '2026-03-03T00:00:00.000Z' },
  { id: 'd', name: 'Stale', kind: 'world', author: { id: 'x', username: 'Other' }, tags: [], updated_at: '2026-03-04T00:00:00.000Z' },
  { id: 'e', name: 'Dictionary Liked', kind: 'dictionary', liked: true, author: { id: 'x', username: 'Other' }, tags: [], updated_at: '2026-03-05T00:00:00.000Z' },
] as unknown as WorldRecord[];

// A real library: two listings are held locally and one of those is out of date. Nothing here is shaped to
// make a facet pass — 'update' is a subset of 'downloaded', which is what makes stacking them meaningful.
const downloadStates: Record<string, DownloadState> = { a: 'refresh', d: 'update' };
const downloadStateOf = (w: WorldRecord): DownloadState => downloadStates[String(w.id)] ?? 'none';

// `viewerId` takes null for signed out rather than undefined: an undefined argument would take the
// signed-in default and quietly test the wrong reader.
const render = (kind: 'world' | 'dictionary' = 'world', viewerId: string | null = ME) =>
  renderHook(() => useCommunityBrowserFilters(catalog, downloadStateOf, true, kind, viewerId ?? undefined));

/**
 * Names left after applying `facets`, with the update float off so the facet is what's under test.
 *
 * Each call is a fresh reader, so the stored settings are cleared first: filters persist, and a second
 * call in the same test would otherwise inherit the first one's facets. `null` means signed out — an
 * `undefined` argument would silently take the signed-in default.
 */
const namesWith = (
  facets: Array<'liked' | 'downloaded' | 'undownloaded' | 'update' | 'mine'>,
  viewerId: string | null = ME,
) => {
  localStorage.clear();
  const { result } = render('world', viewerId);
  act(() => {
    result.current.setSortUpdatesFirst(false);
    facets.forEach((f) => result.current.toggleStatus(f));
  });
  return result.current.filteredRemoteWorlds.map((w) => w.name).sort();
};

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

describe('status facets', () => {
  it('keeps only what the account has liked', () => {
    expect(namesWith(['liked'])).toEqual(['Liked', 'Mine And Liked']);
  });

  it('matches nothing liked when signed out, rather than everything', () => {
    // A Liked chip persisted from a signed-in session must not quietly become a no-op filter.
    expect(namesWith(['liked'], null)).toEqual([]);
  });

  it('splits the catalog on whether a local copy is held', () => {
    expect(namesWith(['downloaded'])).toEqual(['Mine And Liked', 'Stale']);
    // The dictionary listing is undownloaded too, but the world tab never sees it.
    expect(namesWith(['undownloaded'])).toEqual(['Liked', 'Plain']);
  });

  it('finds the copies that are behind the server', () => {
    expect(namesWith(['update'])).toEqual(['Stale']);
  });

  it('keeps only the reader’s own listings', () => {
    expect(namesWith(['mine'])).toEqual(['Mine And Liked']);
  });

  it('requires every facet, not any of them', () => {
    expect(namesWith(['liked', 'mine'])).toEqual(['Mine And Liked']);
    // 'Stale' is downloaded but not liked, 'Liked' is liked but not downloaded.
    expect(namesWith(['liked', 'downloaded'])).toEqual(['Mine And Liked']);
  });

  it('returns nothing for a contradiction rather than ignoring one side', () => {
    expect(namesWith(['downloaded', 'undownloaded'])).toEqual([]);
  });
});

describe('per-kind filter state', () => {
  it('does not carry one tab’s status filter onto another', () => {
    const { result, rerender } = renderHook(
      ({ kind }) => useCommunityBrowserFilters(catalog, downloadStateOf, true, kind, ME),
      { initialProps: { kind: 'world' as 'world' | 'dictionary' } },
    );

    act(() => { result.current.toggleStatus('mine'); });
    expect(result.current.filteredRemoteWorlds.map((w) => w.name)).toEqual(['Mine And Liked']);

    rerender({ kind: 'dictionary' });
    // The dictionary tab was never filtered, so its one listing is still there.
    expect(result.current.statusFilter).toEqual([]);
    expect(result.current.filteredRemoteWorlds.map((w) => w.name)).toEqual(['Dictionary Liked']);

    rerender({ kind: 'world' });
    expect(result.current.statusFilter).toEqual(['mine']);
  });
});

describe('persistence', () => {
  it('restores filters and sort, but never the search text', () => {
    const first = render();
    act(() => {
      first.result.current.toggleStatus('liked');
      first.result.current.setTagFilter(['horror']);
      first.result.current.setSortField('likes');
      first.result.current.applySearchInput('swamp');
    });
    first.unmount();

    const second = render();
    expect(second.result.current.statusFilter).toEqual(['liked']);
    expect(second.result.current.tagFilter).toEqual(['horror']);
    expect(second.result.current.sortField).toBe('likes');
    // Search text from a previous session reads as an empty catalog, so it deliberately does not come back.
    expect(second.result.current.searchQuery).toBe('');
  });

  it('drops a stored facet it does not recognize instead of filtering on it', () => {
    localStorage.setItem('FORMAMORPH_communityFilters', JSON.stringify({
      world: { statusFilter: ['liked', 'beloved'], tagFilter: ['horror'] },
    }));
    const { result } = render();
    expect(result.current.statusFilter).toEqual(['liked']);
  });

  it('falls back to the defaults on a corrupt key', () => {
    localStorage.setItem('FORMAMORPH_communityFilters', 'not json');
    const { result } = render();
    expect(result.current.statusFilter).toEqual([]);
    expect(result.current.sortField).toBe('updated_at');
  });
});

describe('typed filter prefixes', () => {
  it('lifts a finished token out of the search box into a chip', () => {
    const { result } = render();
    act(() => { result.current.applySearchInput('status:liked '); });
    expect(result.current.statusFilter).toEqual(['liked']);
    expect(result.current.searchQuery.trim()).toBe('');
  });

  it('keeps typing in the box until the token is finished', () => {
    const { result } = render();
    act(() => { result.current.applySearchInput('status:lik'); });
    expect(result.current.statusFilter).toEqual([]);
    expect(result.current.searchQuery).toBe('status:lik');
  });

  it('adds an author chip and leaves the plain words searching', () => {
    const { result } = render();
    act(() => { result.current.applySearchInput('author:Me swamp', true); });
    expect(result.current.authorFilter).toEqual(['Me']);
    expect(result.current.searchQuery).toBe('swamp');
  });
});

describe('clearing', () => {
  it('drops the filters and the search but leaves the sort where the reader put it', () => {
    const { result } = render();
    act(() => {
      result.current.toggleStatus('liked');
      result.current.setAuthorFilter(['Me']);
      result.current.setSortField('likes');
      result.current.applySearchInput('swamp');
    });
    act(() => { result.current.clearFilters(); });

    expect(result.current.statusFilter).toEqual([]);
    expect(result.current.authorFilter).toEqual([]);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.sortField).toBe('likes');
  });
});
