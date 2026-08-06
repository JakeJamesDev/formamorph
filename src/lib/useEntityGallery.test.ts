import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntityGallery } from './useEntityGallery';

type IndexMap = Record<string, number>;
const state = vi.hoisted(() => ({ index: {} as IndexMap }));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    entityImageIndex: state.index,
    setEntityImageIndex: (update: IndexMap | ((prev: IndexMap) => IndexMap)) => {
      state.index = typeof update === 'function' ? update(state.index) : update;
    },
  }),
}));

beforeEach(() => { state.index = {}; });

const three = { id: 'sedge', images: ['a', 'b', 'c'] };

describe('useEntityGallery', () => {
  it('starts on the primary and steps forward', () => {
    const { result, rerender } = renderHook(() => useEntityGallery(three));
    expect(result.current.imageIndex).toBe(0);

    act(() => result.current.onImageStep(1));
    rerender();
    expect(result.current.imageIndex).toBe(1);
  });

  it('wraps past the end', () => {
    state.index = { sedge: 2 };
    const { result, rerender } = renderHook(() => useEntityGallery(three));
    act(() => result.current.onImageStep(1));
    rerender();
    expect(result.current.imageIndex).toBe(0);
  });

  it('wraps backwards off the front, where a bare modulo would go negative', () => {
    const { result, rerender } = renderHook(() => useEntityGallery(three));
    act(() => result.current.onImageStep(-1));
    rerender();
    expect(result.current.imageIndex).toBe(2);
  });

  it('steps from a clamped position when the gallery shrank under a stale index', () => {
    state.index = { sedge: 7 };
    const { result } = renderHook(() => useEntityGallery(three));
    // Clamped to the last slot (2), so one step forward wraps to the primary rather than landing on 8.
    act(() => result.current.onImageStep(1));
    expect(state.index.sedge).toBe(0);
  });

  it('does nothing for an entity with a single picture', () => {
    const { result } = renderHook(() => useEntityGallery({ id: 'lone', images: ['a'] }));
    act(() => result.current.onImageStep(1));
    expect(state.index).toEqual({});
  });

  it('leaves other entities alone', () => {
    state.index = { other: 3 };
    const { result } = renderHook(() => useEntityGallery(three));
    act(() => result.current.onImageStep(1));
    expect(state.index).toEqual({ other: 3, sedge: 1 });
  });

  it('is inert without an entity', () => {
    const { result } = renderHook(() => useEntityGallery(undefined));
    expect(result.current.imageIndex).toBe(0);
    act(() => result.current.onImageStep(1));
    expect(state.index).toEqual({});
  });
});
