import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadmeVisibility } from './useReadmeVisibility';

const KEY = 'FORMAMORPH_readmeHiddenWorlds';

describe('useReadmeVisibility', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to shown for any world', () => {
    const { result } = renderHook(() => useReadmeVisibility());
    expect(result.current.showReadme('w1')).toBe(true);
  });

  it('hiding then showing round-trips and persists to localStorage', () => {
    const { result } = renderHook(() => useReadmeVisibility());

    act(() => result.current.setShowReadme('w1', false));
    expect(result.current.showReadme('w1')).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toEqual(['w1']);

    act(() => result.current.setShowReadme('w1', true));
    expect(result.current.showReadme('w1')).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toEqual([]);
  });

  it('scopes the flag per world', () => {
    const { result } = renderHook(() => useReadmeVisibility());
    act(() => result.current.setShowReadme('w1', false));
    expect(result.current.showReadme('w1')).toBe(false);
    expect(result.current.showReadme('w2')).toBe(true);
  });

  it('seeds from an existing localStorage entry', () => {
    localStorage.setItem(KEY, JSON.stringify(['w9']));
    const { result } = renderHook(() => useReadmeVisibility());
    expect(result.current.showReadme('w9')).toBe(false);
    expect(result.current.showReadme('w1')).toBe(true);
  });
});
