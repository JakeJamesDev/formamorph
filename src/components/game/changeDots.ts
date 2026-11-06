import { useCallback, useEffect, useRef, useState } from 'react';
import { enabledStats } from '@/lib/traitEffects';
import type { ItemCopy, OwnedTraitState, PlayerStat, Trait } from '@/types';

/** The right rail tabs that take a dot. */
export const DOT_TABS = ['stats', 'traits', 'inventory'] as const;
export type DotTab = typeof DOT_TABS[number];

/** One string per dot tab, equal exactly when what that tab shows of the player is equal. */
export type StatusSignatures = Record<DotTab, string>;

/** What the player's Stats, Traits and Inventory tabs show, read from live state. */
export function statusSignatures({ stats, statEnabled, traits, disabledTraitIds, playedTraits, copies }: {
  stats: readonly PlayerStat[];
  statEnabled: Readonly<Record<string, boolean>>;
  traits: readonly Trait[];
  disabledTraitIds: readonly string[];
  /** The owned traits of each entity the player plays. */
  playedTraits: readonly (OwnedTraitState | undefined)[];
  copies: readonly ItemCopy[];
}): StatusSignatures {
  const shownStats = enabledStats([...stats], statEnabled).filter((stat) => stat.hidden !== true);
  const carried = copies.filter((copy) => copy.where.kind === 'you' && copy.visibility === 'visible');
  return {
    stats: JSON.stringify(shownStats.map((stat) => [stat.id, stat.value])),
    traits: JSON.stringify([
      traits.map((trait) => trait.id), [...disabledTraitIds].sort(),
      playedTraits.map((owned) => owned && [owned.chosen, owned.disabled ?? [], owned.granted ?? []]),
    ]),
    inventory: JSON.stringify(carried.map((copy) => [copy.id, copy.item, copy.quantity, copy.equipped?.slotId ?? null, copy.state ?? null])),
  };
}

/**
 * The dot set for the right rail. A tab gains a dot when its signature changes while `watching` and it isn't
 * `shownTab`; showing a tab clears its dot. `rebase` drops every dot and takes the state of the render it
 * commits with as the baseline, so a call made with a game's seeding or after a load adopts that state.
 */
export function useChangeDots(signatures: StatusSignatures, { watching, shownTab }: { watching: boolean; shownTab: string | null }) {
  const [dots, setDots] = useState<ReadonlySet<DotTab>>(() => new Set());
  const [epoch, setEpoch] = useState(0);
  const baseline = useRef({ signatures, epoch });

  const { stats, traits, inventory } = signatures;
  useEffect(() => {
    const now = { stats, traits, inventory };
    const rebased = baseline.current.epoch !== epoch;
    const changed = rebased ? [] : DOT_TABS.filter((tab) => now[tab] !== baseline.current.signatures[tab]);
    baseline.current = { signatures: now, epoch };
    const added = watching ? changed.filter((tab) => tab !== shownTab) : [];
    const cleared = DOT_TABS.find((tab) => tab === shownTab);
    setDots((prev) => {
      if (!added.some((tab) => !prev.has(tab)) && !(cleared && prev.has(cleared))) return prev;
      const next = new Set(prev);
      added.forEach((tab) => next.add(tab));
      if (cleared) next.delete(cleared);
      return next;
    });
  }, [stats, traits, inventory, watching, shownTab, epoch]);

  const rebase = useCallback(() => {
    setEpoch((e) => e + 1);
    setDots(new Set());
  }, []);
  return { dots, rebase };
}
