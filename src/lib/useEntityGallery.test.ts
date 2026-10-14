// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEntityGallery } from './useEntityGallery';
import type { GateInput } from './traitGates';
import type { GalleryImage, StatRequirement } from '@/types';

type IndexMap = Record<string, number>;
const state = vi.hoisted(() => ({ index: {} as IndexMap, health: 50 }));

vi.mock('@/contexts/GameplayContext', () => ({
  useGameplay: () => ({
    entityImageIndex: state.index,
    setEntityImageIndex: (update: IndexMap | ((prev: IndexMap) => IndexMap)) => {
      state.index = typeof update === 'function' ? update(state.index) : update;
    },
  }),
}));

// The turn on screen: Sedge's Health is the one stat the rules below read.
vi.mock('./useViewedGateInput', () => ({
  useViewedGateInput: (): GateInput => ({
    global: { traits: [], groups: [] },
    owners: [],
    active: { global: [], owners: {} },
    stats: { global: {}, owners: { sedge: { health: { name: 'Health', value: state.health, min: 0, max: 100 } } } },
    entities: [{ id: 'sedge', name: 'Sedge' }],
    persona: { source: 'none' },
  }),
}));

beforeEach(() => { state.index = {}; state.health = 50; });

const three = { id: 'sedge', images: [{ data: 'a' }, { data: 'b' }, { data: 'c' }] };
const hurt: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'raw' };
const whenHurt = (data: string): GalleryImage => ({ data, requires: [{ all: [hurt] }] });
/** The middle image shows only while Sedge is hurt. */
const gated = { id: 'sedge', images: [{ data: 'a' }, whenHurt('wounded'), { data: 'c' }] };

const shownOf = (current: { images: readonly string[]; imageIndex: number }) => current.images[current.imageIndex];

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

  it('reads a stale index from a shrunk gallery as the primary, and steps from there', () => {
    state.index = { sedge: 7 };
    const { result } = renderHook(() => useEntityGallery(three));
    expect(shownOf(result.current)).toBe('a');
    act(() => result.current.onImageStep(1));
    expect(state.index.sedge).toBe(1);
  });

  it('does nothing for an entity with a single picture', () => {
    const { result } = renderHook(() => useEntityGallery({ id: 'lone', images: [{ data: 'a' }] }));
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
    expect(result.current.images).toEqual([]);
    act(() => result.current.onImageStep(1));
    expect(state.index).toEqual({});
  });
});

describe('useEntityGallery — visibility rules', () => {
  it('lists only the visible images, in author order', () => {
    const { result, rerender } = renderHook(() => useEntityGallery(gated));
    expect(result.current.images).toEqual(['a', 'c']);
    state.health = 10;
    rerender();
    expect(result.current.images).toEqual(['a', 'wounded', 'c']);
  });

  it('keeps the player’s image when it stays visible as the list changes', () => {
    // A fourth image, so the player's image moves position as the wounded one comes and goes.
    const four = { ...gated, images: [...gated.images, { data: 'd' }] };
    state.health = 10;
    state.index = { sedge: 2 };
    const { result, rerender } = renderHook(() => useEntityGallery(four));
    expect(result.current.imageIndex).toBe(2);
    expect(shownOf(result.current)).toBe('c');
    state.health = 90;
    rerender();
    expect(result.current.imageIndex).toBe(1);
    expect(shownOf(result.current)).toBe('c');
  });

  it('lands on the primary when the player’s image hides, and returns to it when it shows again', () => {
    state.health = 10;
    state.index = { sedge: 1 };
    const { result, rerender } = renderHook(() => useEntityGallery(gated));
    expect(shownOf(result.current)).toBe('wounded');

    state.health = 90;
    rerender();
    expect(shownOf(result.current)).toBe('a');
    // Viewing a turn never writes gallery state (Q35).
    expect(state.index).toEqual({ sedge: 1 });

    state.health = 10;
    rerender();
    expect(shownOf(result.current)).toBe('wounded');
  });

  it('pages over the visible images only, wrapping both ways', () => {
    const { result, rerender } = renderHook(() => useEntityGallery(gated));
    act(() => result.current.onImageStep(1));
    rerender();
    expect(shownOf(result.current)).toBe('c');
    act(() => result.current.onImageStep(1));
    rerender();
    expect(shownOf(result.current)).toBe('a');
    act(() => result.current.onImageStep(-1));
    rerender();
    expect(shownOf(result.current)).toBe('c');
  });

  it('steps from the primary when the player’s image is hidden', () => {
    state.index = { sedge: 1 };
    const { result } = renderHook(() => useEntityGallery(gated));
    act(() => result.current.onImageStep(1));
    expect(state.index.sedge).toBe(2);
  });

  it('shows nothing when every image hides', () => {
    const { result } = renderHook(() => useEntityGallery({ id: 'sedge', images: [whenHurt('x'), whenHurt('y')] }));
    expect(result.current.images).toEqual([]);
    act(() => result.current.onImageStep(1));
    expect(state.index).toEqual({});
  });
});
