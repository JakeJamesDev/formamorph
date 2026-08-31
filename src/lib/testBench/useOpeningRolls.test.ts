import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { WorldOverview } from '@/types';
import { buildLens } from './lens';
import type { OpeningWorld } from './opening';
import { useOpeningRolls } from './useOpeningRolls';

import { phValues } from '@/test/placeholderValues';
const world = (systemPrompt: string): OpeningWorld => ({
  worldOverview: { name: 'W', description: '', systemPrompt } as WorldOverview,
  stats: [], locations: [], entities: [], traits: [], statUpdates: [], dictionaries: [],
  placeholders: [
    { id: 'ph-a', name: 'A', values: phValues(['x', 'y']) },
    { id: 'ph-b', name: 'B', values: phValues(['p', 'q']) },
  ],
});

const oneChip = world('{{ph:ph-a:world:pl-1}}');
const twoChips = world('{{ph:ph-a:world:pl-1}} {{ph:ph-b:world:pl-2}}');

describe('useOpeningRolls', () => {
  it('rolls nothing until the instrument is watching', () => {
    const { result } = renderHook(() => useOpeningRolls(oneChip, false));
    expect(result.current.rolls).toEqual({});
  });

  it('primes every placement once live, and keeps existing rolls when the world grows', () => {
    const { result, rerender } = renderHook(
      ({ w, live }) => useOpeningRolls(w, live),
      { initialProps: { w: oneChip, live: true } },
    );
    const first = result.current.rolls.world?.['ph-a'];
    expect(['x', 'y']).toContain(first);
    rerender({ w: twoChips, live: true });
    expect(result.current.rolls.world?.['ph-a']).toBe(first);
    expect(['p', 'q']).toContain(result.current.rolls.world?.['ph-b']);
  });

  it('keeps the same rolls object when a re-prime adds nothing', () => {
    const { result, rerender } = renderHook(
      ({ w }) => useOpeningRolls(w, true),
      { initialProps: { w: oneChip } },
    );
    const before = result.current.rolls;
    // A new world identity with the same placements — the identity guard must swallow the no-op prime.
    rerender({ w: { ...oneChip } });
    expect(result.current.rolls).toBe(before);
  });

  it('rerolls the unpinned placements on demand', () => {
    const { result } = renderHook(() => useOpeningRolls(oneChip, true));
    act(() => result.current.reroll(buildLens(oneChip, { pcTraitId: null, locationId: null })));
    // The draw is random, but the placement set it covers is not.
    expect(Object.keys(result.current.rolls.world ?? {})).toEqual(['ph-a']);
  });
});
