import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlaceholderRolls } from '@/types';
import type { BenchLens } from './lens';
import { primeOpeningRolls, rerollOpeningRolls, type OpeningWorld } from './opening';

/** Same rolls, key for key. Priming only ever adds keys, so this is an add-nothing check. */
const sameRolls = (a: PlaceholderRolls, b: PlaceholderRolls): boolean => {
  const same = (x: Record<string, string> = {}, y: Record<string, string> = {}) => {
    const keys = Object.keys(y);
    return keys.length === Object.keys(x).length && keys.every((k) => x[k] === y[k]);
  };
  return same(a.world, b.world) && same(a.unique, b.unique);
};

export interface OpeningRollsHandle {
  rolls: PlaceholderRolls;
  reroll: (lens: BenchLens) => void;
}

/**
 * The Opening instrument's frozen rolls: primed while the instrument is watching, held across tab switches
 * so an author's rolled setup is a loop, not a ritual. An edit that adds a placement draws just that one —
 * existing rolls keep, the identity guard keeping a no-op prime from re-rendering anything.
 */
export function useOpeningRolls(world: OpeningWorld, live: boolean): OpeningRollsHandle {
  const [rolls, setRolls] = useState<PlaceholderRolls>({});
  useEffect(() => {
    if (!live) return;
    setRolls((prev) => {
      const next = primeOpeningRolls(world, prev);
      return sameRolls(prev, next) ? prev : next;
    });
  }, [live, world]);
  const reroll = useCallback(
    (lens: BenchLens) => setRolls((prev) => rerollOpeningRolls(world, lens, prev)),
    [world],
  );
  // A stable handle, so a consumer callback keyed on it survives unrelated re-renders.
  return useMemo(() => ({ rolls, reroll }), [rolls, reroll]);
}
