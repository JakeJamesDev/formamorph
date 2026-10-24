// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEFAULT_BACKGROUND, useLocationBackdrop, useMapBackdrop } from './useLocationBackdrop';
import type { GateInput } from './traitGates';
import type { GalleryImage, StatRequirement } from '@/types';

const state = vi.hoisted(() => ({ health: 50 }));

// The turn on screen: Wren is the played persona, and her Health is the stat the rules read.
vi.mock('./useViewedGateInput', () => ({
  useViewedGateInput: (): GateInput => ({
    global: { traits: [], groups: [] },
    owners: [],
    active: { global: [], owners: {} },
    stats: { global: {}, owners: { wren: { health: { name: 'Health', value: state.health, min: 0, max: 100 } } } },
    entities: [{ id: 'wren', name: 'Wren', persona: true }],
    persona: { source: 'world', entityId: 'wren' },
  }),
}));

beforeEach(() => { state.health = 50; });

const hurt: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'raw' };
const when = (data: string, req: StatRequirement): GalleryImage => ({ data, requires: [{ all: [req] }] });

describe('useLocationBackdrop', () => {
  it('swaps the backdrop as the persona’s Health crosses the line', () => {
    const square = { images: [when('wounded', hurt), { data: 'healthy' }] };
    const { result, rerender } = renderHook(() => useLocationBackdrop(square));
    expect(result.current).toBe('healthy');
    state.health = 10;
    rerender();
    expect(result.current).toBe('wounded');
  });

  it('paints no backdrop when no image passes its rule', () => {
    const square = { images: [when('wounded', hurt)] };
    expect(renderHook(() => useLocationBackdrop(square)).result.current).toBeUndefined();
  });

  it('paints no backdrop for a location with no images', () => {
    expect(renderHook(() => useLocationBackdrop({})).result.current).toBeUndefined();
  });

  it('shows the default background only when there is no location', () => {
    expect(renderHook(() => useLocationBackdrop(null)).result.current).toBe(DEFAULT_BACKGROUND);
  });
});

describe('useMapBackdrop', () => {
  const frame = { x: -40, y: 0, width: 900, height: 500 };
  const overview = (images: GalleryImage[]) => ({ mapBackground: { images, frame, opacity: 0.7 } });

  it('swaps to a ruled image while an owner-less row holds on the persona, in the same frame', () => {
    const map = overview([when('ruined', hurt), { data: 'drawn' }]);
    const { result, rerender } = renderHook(() => useMapBackdrop(map));
    expect(result.current).toEqual({ data: 'drawn', frame, opacity: 0.7 });
    state.health = 10;
    rerender();
    expect(result.current).toEqual({ data: 'ruined', frame, opacity: 0.7 });
  });

  it('draws nothing when no image passes, or the world has none', () => {
    expect(renderHook(() => useMapBackdrop(overview([when('ruined', hurt)]))).result.current).toBeUndefined();
    expect(renderHook(() => useMapBackdrop({})).result.current).toBeUndefined();
  });
});
