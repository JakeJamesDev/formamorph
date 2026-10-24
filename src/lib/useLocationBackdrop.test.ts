// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEFAULT_BACKGROUND, useLocationBackdrop } from './useLocationBackdrop';
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
