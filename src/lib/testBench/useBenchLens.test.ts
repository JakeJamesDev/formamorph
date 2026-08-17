import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { GameLocation, Trait, TraitGroup } from '@/types';
import type { LensWorld } from './lens';
import { readLensState } from './lensStore';
import { useBenchLens } from './useBenchLens';

const traitGroups: TraitGroup[] = [{ id: 'g-origin', name: 'Origin', parentId: null, exclusive: true }];
const traits: Trait[] = [
  { id: 't-sedge', name: 'Sedge-Born', groupId: 'g-origin', statChanges: [], order: 0 },
  { id: 't-reach', name: 'Reach-Born', groupId: 'g-origin', statChanges: [], order: 1 },
];
const locations: GameLocation[] = [
  { id: 'loc-market', name: 'The Long Market' },
  { id: 'loc-harbor', name: 'Harbor Steps', isStarting: true },
];

const world: LensWorld = { traits, traitGroups, locations, placeholders: [], stats: [] };

const mount = (props: { open: boolean; selectedLocationId: string | null }) =>
  renderHook(({ open, selectedLocationId }) => useBenchLens('w1', world, { open, selectedLocationId }), {
    initialProps: props,
  });

beforeEach(() => sessionStorage.clear());

describe('useBenchLens', () => {
  it('seeds from the editor’s selected location the moment the Bench opens', () => {
    const { result, rerender } = mount({ open: false, selectedLocationId: 'loc-market' });
    expect(result.current.lens.location).toBeNull();
    rerender({ open: true, selectedLocationId: 'loc-market' });
    expect(result.current.lens.location?.id).toBe('loc-market');
  });

  it('seeds to the starting location when the editor has no location selected', () => {
    const { result } = mount({ open: true, selectedLocationId: null });
    expect(result.current.lens.location?.id).toBe('loc-harbor');
  });

  it('holds its own once open — moving the editor’s selection does not re-aim it', () => {
    const { result, rerender } = mount({ open: true, selectedLocationId: 'loc-market' });
    rerender({ open: true, selectedLocationId: 'loc-harbor' });
    expect(result.current.lens.location?.id).toBe('loc-market');
  });

  it('survives an edit to the world — a keystroke in the editor is not a re-seed', () => {
    const { result, rerender } = renderHook(
      ({ w }) => useBenchLens('w1', w, { open: true, selectedLocationId: null }),
      { initialProps: { w: world } },
    );
    act(() => { result.current.setLocation('loc-market'); });
    rerender({ w: { ...world, locations: [...locations] } });
    expect(result.current.lens.location?.id).toBe('loc-market');
  });

  it('carries a selection across a close and re-open, over the editor’s own', () => {
    const first = mount({ open: true, selectedLocationId: 'loc-market' });
    act(() => { first.result.current.setPc('t-reach'); });
    act(() => { first.result.current.setLocation('loc-harbor'); });
    first.unmount();

    const second = mount({ open: true, selectedLocationId: 'loc-market' });
    expect(second.result.current.lens.pc?.id).toBe('t-reach');
    expect(second.result.current.lens.location?.id).toBe('loc-harbor');
  });

  it('records nothing until the author picks something, so a seed is not a choice', () => {
    mount({ open: true, selectedLocationId: 'loc-market' });
    expect(readLensState('w1')).toBeNull();
  });

  it('re-seeds rather than restoring a selection the world no longer has', () => {
    const first = mount({ open: true, selectedLocationId: null });
    act(() => { first.result.current.setLocation('loc-market'); });
    first.unmount();

    const shrunk: LensWorld = { ...world, locations: [locations[1]] };
    const { result } = renderHook(() =>
      useBenchLens('w1', shrunk, { open: true, selectedLocationId: null }));
    expect(result.current.lens.location?.id).toBe('loc-harbor');
  });

  it('never writes the world it reads', () => {
    const snapshot = JSON.stringify(world);
    const { result } = mount({ open: true, selectedLocationId: 'loc-market' });
    act(() => { result.current.setPc('t-sedge'); });
    expect(JSON.stringify(world)).toBe(snapshot);
  });
});
