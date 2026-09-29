import { useEffect, useRef } from 'react';
import { settleTraits, type GatedTraitResult, type TraitRuntimeState, type TraitWorld } from './traitRuntime';
import type { Trait } from '@/types';

/**
 * Settle every bearer's traits against the current world once per save load (Q34), after the loaded state
 * and its world have rendered. `loads` is the gameplay save-load count; loads before mount don't settle.
 * A load that changes nothing commits nothing.
 */
export function useSettleOnSaveLoad(
  loads: number,
  state: TraitRuntimeState,
  world: () => TraitWorld,
  nameOf: (trait: Trait) => string,
  commit: (result: GatedTraitResult) => void,
): void {
  const settledLoads = useRef(loads);
  useEffect(() => {
    if (loads === settledLoads.current) return;
    settledLoads.current = loads;
    const result = settleTraits(state, world(), nameOf);
    if (result.state !== state) commit(result);
  }, [loads, state, world, nameOf, commit]);
}
