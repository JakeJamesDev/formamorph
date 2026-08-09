import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableIds } from './useStableIds';

describe('useStableIds', () => {
  it('keeps an id with its item when the list is reordered', () => {
    const { result, rerender } = renderHook(({ items }) => useStableIds(items), {
      initialProps: { items: ['a', 'b', 'c'] },
    });
    const [idA, idB, idC] = result.current;

    rerender({ items: ['c', 'a', 'b'] });

    // The ids move with the pictures — that is what lets React move the nodes instead of rewriting them.
    expect(result.current).toEqual([idC, idA, idB]);
  });

  it('gives a repeated value its own id rather than collapsing the two', () => {
    const { result } = renderHook(() => useStableIds(['a', 'a', 'b']));

    expect(new Set(result.current).size).toBe(3);
  });

  it('keeps the surviving ids when one item is removed', () => {
    const { result, rerender } = renderHook(({ items }) => useStableIds(items), {
      initialProps: { items: ['a', 'b', 'c'] },
    });
    const [idA, , idC] = result.current;

    rerender({ items: ['a', 'c'] });

    expect(result.current).toEqual([idA, idC]);
  });

  it('mints an id only for the item that is actually new', () => {
    const { result, rerender } = renderHook(({ items }) => useStableIds(items), {
      initialProps: { items: ['a', 'b'] },
    });
    const [idA, idB] = result.current;

    rerender({ items: ['a', 'b', 'c'] });

    expect(result.current.slice(0, 2)).toEqual([idA, idB]);
    expect(result.current[2]).not.toBe(idB);
  });

  it('does not mint new ids when the same list renders again', () => {
    const { result, rerender } = renderHook(({ items }) => useStableIds(items), {
      initialProps: { items: ['a', 'b'] },
    });
    const first = result.current;

    rerender({ items: ['a', 'b'] });

    expect(result.current).toEqual(first);
  });
});
