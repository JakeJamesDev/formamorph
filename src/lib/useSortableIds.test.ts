import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { sameIds, useSortableIds } from './useSortableIds';

describe('sameIds', () => {
  it('accepts the same ids in the same order', () => {
    expect(sameIds(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
  });

  it('rejects a reorder, a removal, and an addition', () => {
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameIds(['a', 'b'], ['a'])).toBe(false);
    expect(sameIds(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('useSortableIds', () => {
  it('holds one array across a render that rebuilt the items', () => {
    // The trap this exists for: a list whose items array is rebuilt every render (a filter, a map, a
    // freshly spread copy) hands dnd-kit a new reference each time and kills the sort animation.
    const { result, rerender } = renderHook(
      ({ items }: { items: { id: string }[] }) => useSortableIds(items, (i) => i.id),
      { initialProps: { items: [{ id: 'a' }, { id: 'b' }] } },
    );
    const first = result.current;
    rerender({ items: [{ id: 'a' }, { id: 'b' }] });

    expect(result.current).toBe(first);
    expect(result.current).toEqual(['a', 'b']);
  });

  it('answers with a new array once the ids really change', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: string[] }) => useSortableIds(items, (i) => i),
      { initialProps: { items: ['a', 'b'] } },
    );
    const first = result.current;
    rerender({ items: ['b', 'a'] });

    expect(result.current).not.toBe(first);
    expect(result.current).toEqual(['b', 'a']);
  });

  it('reads ids through the caller\'s accessor, so a keyed list is not forced onto `id`', () => {
    const { result } = renderHook(() =>
      useSortableIds([{ key: 'folder-1' }, { key: 'folder-2' }], (f) => f.key));

    expect(result.current).toEqual(['folder-1', 'folder-2']);
  });
});
