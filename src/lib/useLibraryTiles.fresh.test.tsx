import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLibraryTiles } from './useLibraryTiles';
import { SEEN_STORAGE_KEYS, emptyTabOrganization, resolvePlacements, saveTabOrganization } from '@/lib/libraryOrganization';

const seenIds = () => JSON.parse(localStorage.getItem(SEEN_STORAGE_KEYS.worlds) ?? 'null') as string[] | null;

describe('useLibraryTiles fresh items', () => {
  beforeEach(() => localStorage.clear());

  it('points out nothing in the library it first loads', () => {
    const { result } = renderHook(() => useLibraryTiles('worlds', ['a', 'b'], true));

    expect(result.current.isFresh('a')).toBe(false);
    expect(seenIds()).toEqual(['a', 'b']);
  });

  it('points out an item that arrives later, until it is seen', () => {
    const { result, rerender } = renderHook(({ ids }) => useLibraryTiles('worlds', ids, true), {
      initialProps: { ids: ['a'] },
    });
    rerender({ ids: ['a', 'new'] });

    expect(result.current.isFresh('new')).toBe(true);
    act(() => result.current.markSeen('new'));
    expect(result.current.isFresh('new')).toBe(false);
    expect(seenIds()).toEqual(['a', 'new']);
  });

  it('waits for the real list before recording what was there', () => {
    const { result, rerender } = renderHook(({ ids, ready }) => useLibraryTiles('worlds', ids, ready), {
      initialProps: { ids: [] as string[], ready: false },
    });
    expect(seenIds()).toBeNull();

    rerender({ ids: ['a'], ready: true });

    expect(result.current.isFresh('a')).toBe(false);
  });

  it('forgets deleted items when it records a new one', () => {
    localStorage.setItem(SEEN_STORAGE_KEYS.worlds, JSON.stringify(['gone', 'a']));
    const { result } = renderHook(() => useLibraryTiles('worlds', ['a', 'new'], true));

    act(() => result.current.markSeen('new'));

    expect(seenIds()).toEqual(['a', 'new']);
  });
});

describe('useLibraryTiles on the first load after an update', () => {
  beforeEach(() => localStorage.clear());

  // A board the released version saved: `loose` was never dragged, so it has no home and no order entry.
  const released = () => ({
    ...emptyTabOrganization(),
    order: ['a', 'b', 'c'],
    placements: { 8: { a: { row: 0, col: 0 }, b: { row: 0, col: 4 }, c: { row: 2, col: 2 } } },
  });

  it('leaves the saved arrangement exactly as it was', () => {
    saveTabOrganization('worlds', released());
    const { result } = renderHook(() => useLibraryTiles('worlds', ['a', 'b', 'c', 'loose'], true));

    expect(result.current.organization).toEqual(released());
    // The never-dragged tile still fills the hole, as it did before the update.
    expect(resolvePlacements(result.current.organization, ['a', 'b', 'c', 'loose'], 8).loose)
      .toEqual({ row: 0, col: 2 });
  });

  it('saves an item that arrives afterwards a home at the end of the arrangement', () => {
    saveTabOrganization('worlds', released());
    const { result, rerender } = renderHook(({ ids }) => useLibraryTiles('worlds', ids, true), {
      initialProps: { ids: ['a', 'b', 'c', 'loose'] },
    });
    rerender({ ids: ['a', 'b', 'c', 'loose', 'new'] });

    expect(result.current.organization.placements[8].new).toEqual({ row: 2, col: 4 });
    act(() => result.current.markSeen('new'));
    expect(resolvePlacements(result.current.organization, result.current.topLevel, 8).new)
      .toEqual({ row: 2, col: 4 });
  });
});

describe('useLibraryTiles after a load that failed', () => {
  beforeEach(() => localStorage.clear());

  it('records nothing from an empty list, so the next good load arrives as the existing library', () => {
    const { unmount } = renderHook(() => useLibraryTiles('worlds', [], true));
    expect(seenIds()).toBeNull();
    unmount();

    const { result } = renderHook(() => useLibraryTiles('worlds', ['a', 'b'], true));

    expect(result.current.isFresh('a')).toBe(false);
    expect(seenIds()).toEqual(['a', 'b']);
  });
});
