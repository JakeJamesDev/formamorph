import { useCallback, useEffect, useRef, useState } from 'react';
import { settleTraits, type GatedTraitResult, type TraitRuntimeState, type TraitSettle, type TraitWorld } from './traitRuntime';
import type { GateStats } from './traitGates';
import { useMountedRef } from './useMountedRef';
import type { Trait } from '@/types';

interface PendingSettle<Action> {
  nonce: number;
  gateStats: GateStats | null;
  action: Action;
  resolve: () => void;
  /** The settle has committed; the next render holds its result. */
  committed?: true;
  /** What the commit still runs: the switch scripts the settle fired. */
  landing?: Promise<void>;
}

/**
 * The per-turn settle (Q9, Q19). `settle` waits for the render that holds every update the commit queued
 * before it, then settles every owner's traits once against `gateStats`, the commit's one stat snapshot.
 * It resolves once a render holds what the settle committed, so a snapshot armed after it captures that.
 * Null `gateStats` reads the stats as they landed. A settle that moves nothing commits nothing. An unmount
 * resolves a pending settle without settling, and a settle asked for after it resolves at once. A commit that
 * answers a promise holds the settle until it resolves. `action` reaches the commit as the caller passed it.
 */
export function useTurnSettle<Action = void>(
  state: TraitRuntimeState,
  world: () => TraitWorld,
  nameOf: (trait: Trait) => string,
  commit: (result: GatedTraitResult, action: Action) => void | Promise<void>,
  settle: TraitSettle = settleTraits,
): (gateStats: GateStats | null, action: Action) => Promise<void> {
  const pending = useRef<PendingSettle<Action> | null>(null);
  const [nonce, setNonce] = useState(0);
  const nonceRef = useRef(0);
  const bump = () => {
    nonceRef.current += 1;
    setNonce(nonceRef.current);
    return nonceRef.current;
  };

  useEffect(() => {
    const at = pending.current;
    if (!at || at.nonce !== nonce) return;
    if (at.committed) {
      pending.current = null;
      if (at.landing) void at.landing.then(at.resolve, at.resolve);
      else at.resolve();
      return;
    }
    const live = world();
    const result = settle(state, at.gateStats ? { ...live, gateStats: at.gateStats } : live, nameOf);
    if (result.state === state) {
      pending.current = null;
      at.resolve();
      return;
    }
    const landing = commit(result, at.action);
    pending.current = { ...at, committed: true, nonce: bump(), ...(landing ? { landing } : {}) };
  }, [nonce, state, world, nameOf, commit, settle]);

  const mounted = useMountedRef();
  useEffect(() => () => {
    pending.current?.resolve();
    pending.current = null;
  }, []);

  return useCallback((gateStats: GateStats | null, action: Action) => new Promise<void>((resolve) => {
    pending.current?.resolve();
    pending.current = null;
    if (!mounted.current) {
      resolve();
      return;
    }
    pending.current = { nonce: bump(), gateStats, action, resolve };
  }), [mounted]);
}
