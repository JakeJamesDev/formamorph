import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCardCollapse } from './cardCollapse';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `row-${i + 1}`);

describe('useCardCollapse', () => {
  it('opens a list of two rows expanded', () => {
    const { result } = renderHook(() => useCardCollapse(ids(2)));
    expect(ids(2).map(result.current.isOpen)).toEqual([true, true]);
  });

  it('opens a list of three rows collapsed', () => {
    const { result } = renderHook(() => useCardCollapse(ids(3)));
    expect(ids(3).map(result.current.isOpen)).toEqual([false, false, false]);
    expect(result.current.anyOpen).toBe(false);
  });

  it('opens a row added after mount expanded, even in a collapsed list', () => {
    const { result, rerender } = renderHook(({ rows }) => useCardCollapse(rows), { initialProps: { rows: ids(3) } });
    rerender({ rows: [...ids(3), 'fresh'] });
    expect(result.current.isOpen('fresh')).toBe(true);
    expect(result.current.isOpen('row-1')).toBe(false);
  });

  it('toggles one row without touching the others', () => {
    const { result } = renderHook(() => useCardCollapse(ids(3)));
    act(() => result.current.toggle('row-2'));
    expect(ids(3).map(result.current.isOpen)).toEqual([false, true, false]);
    act(() => result.current.toggle('row-2'));
    expect(result.current.isOpen('row-2')).toBe(false);
  });

  it('expands every row, then collapses every row', () => {
    const { result } = renderHook(() => useCardCollapse(ids(3)));
    act(() => result.current.toggleAll());
    expect(ids(3).map(result.current.isOpen)).toEqual([true, true, true]);
    act(() => result.current.toggleAll());
    expect(ids(3).map(result.current.isOpen)).toEqual([false, false, false]);
  });

  it('applies the open-on-mount rule again on reset', () => {
    const { result } = renderHook(() => useCardCollapse(ids(1)));
    act(() => result.current.reset(ids(4)));
    expect(ids(4).map(result.current.isOpen)).toEqual([false, false, false, false]);
    act(() => result.current.reset(ids(2)));
    expect(ids(2).map(result.current.isOpen)).toEqual([true, true]);
  });
});
