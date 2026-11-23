// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DEFAULT_BACKGROUND, useLocationBackdrop, useMapBackdrop } from './useLocationBackdrop';
import type { GateInput } from './traitGates';
import type { GalleryImage, StatRequirement } from '@/types';

const state = vi.hoisted(() => ({ health: 50, override: undefined as string | undefined }));

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

// A script's override of the square's image, by entry id, and the list it names.
vi.mock('./useMediaOverrides', () => ({
  useViewedMediaOverrides: () => ({
    entity: () => undefined, location: (id: string) => (id === 'square' ? state.override : undefined), item: () => undefined, music: () => undefined,
    entityPicture: () => ({}), locationPicture: (id: string) => (id === 'square' && state.override ? { id: state.override } : {}), itemPicture: () => ({}),
  }),
}));
vi.mock('./useMediaList', () => ({ useMediaList: () => ({
  'm-storm': { id: 'm-storm', name: 'Storm', kind: 'image', data: 'storm' },
  'm-day': { id: 'm-day', name: 'Day', kind: 'image', data: 'day' },
  'k-window': { id: 'k-window', name: 'Window', kind: 'mask', data: 'window-mask' },
  'k-porch': { id: 'k-porch', name: 'Porch', kind: 'mask', data: 'porch-mask' },
}) }));

beforeEach(() => { state.health = 50; state.override = undefined; });

const hurt: StatRequirement = { kind: 'stat', id: 'health', operator: '<', value: 20, unit: 'raw' };
const when = (data: string, req: StatRequirement): GalleryImage => ({ data, requires: [{ all: [req] }] });

describe('useLocationBackdrop', () => {
  it('swaps the backdrop as the persona’s Health crosses the line', () => {
    const square = { id: 'square', images: [when('wounded', hurt), { data: 'healthy' }] };
    const { result, rerender } = renderHook(() => useLocationBackdrop(square));
    expect(result.current.picture).toBe('healthy');
    state.health = 10;
    rerender();
    expect(result.current.picture).toBe('wounded');
  });

  it('paints a script’s override over the rules until it clears', () => {
    const square = { id: 'square', images: [when('wounded', hurt), { data: 'healthy' }] };
    state.health = 10;
    state.override = 'm-storm';
    const { result, rerender } = renderHook(() => useLocationBackdrop(square));
    expect(result.current.picture).toBe('storm');
    state.override = undefined;
    rerender();
    expect(result.current.picture).toBe('wounded');
  });

  it('paints no backdrop when no image passes its rule', () => {
    const square = { id: 'square', images: [when('wounded', hurt)] };
    expect(renderHook(() => useLocationBackdrop(square)).result.current.picture).toBeUndefined();
  });

  it('paints no backdrop for a location with no images', () => {
    expect(renderHook(() => useLocationBackdrop({ id: 'empty' })).result.current.picture).toBeUndefined();
  });

  it('shows the default background only when there is no location', () => {
    expect(renderHook(() => useLocationBackdrop(null)).result.current.picture).toBe(DEFAULT_BACKGROUND);
  });

  it('carries the shown slot’s mask, which follows the rule-visible picture', () => {
    const square = { id: 'square', images: [{ ...when('wounded', hurt), weatherMask: 'k-porch' }, { data: 'healthy', weatherMask: 'k-window' }] };
    const { result, rerender } = renderHook(() => useLocationBackdrop(square));
    expect(result.current).toEqual({ picture: 'healthy', mask: 'window-mask' });
    state.health = 10;
    rerender();
    expect(result.current).toEqual({ picture: 'wounded', mask: 'porch-mask' });
  });

  it('reads a missing or non-Mask entry as no mask', () => {
    expect(renderHook(() => useLocationBackdrop({ id: 'a', images: [{ data: 'x', weatherMask: 'gone' }] })).result.current.mask).toBeUndefined();
    expect(renderHook(() => useLocationBackdrop({ id: 'b', images: [{ data: 'x', weatherMask: 'm-storm' }] })).result.current.mask).toBeUndefined();
  });

  it('gives a script’s override the mask of the first slot linking its entry, else none', () => {
    state.override = 'm-storm';
    const linked = { id: 'square', images: [{ data: 'healthy', weatherMask: 'k-porch' }, { mediaId: 'm-storm', weatherMask: 'k-window' }] };
    expect(renderHook(() => useLocationBackdrop(linked)).result.current).toEqual({ picture: 'storm', mask: 'window-mask' });
    const unlinked = { id: 'square', images: [{ data: 'healthy', weatherMask: 'k-porch' }] };
    expect(renderHook(() => useLocationBackdrop(unlinked)).result.current).toEqual({ picture: 'storm', mask: undefined });
  });

  it('carries no mask with no location', () => {
    expect(renderHook(() => useLocationBackdrop(null)).result.current.mask).toBeUndefined();
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
