import { useCallback, useEffect, useMemo, useState } from 'react';
import WorldStorageService from '@/services/WorldStorageService';
import { kindOf } from '@/lib/catalogKinds';
import {
  addonTabs, downloadItemCount, listingId,
  type AddonRow, type AddonTabs, type DependencyRow,
} from '@/lib/worldDependencies';
import type { DownloadPlan, SelectedAddon } from '@/lib/useDownloadCoordinator';
import type { WorldRecord } from '@/components/WorldDetails';

/** What the download review shows for one world, and what the player chose to take with it. */
export interface WorldDownloadPlan {
  /** The world's required sources, each already resolved by the server. */
  dependencies: DependencyRow[];
  tabs: AddonTabs;
  /** The add-ons the player ticked. This is what the download coordinator is handed. */
  plan: DownloadPlan;
  toggle: (addon: SelectedAddon, on: boolean) => void;
  /** Required sources plus selected add-ons — what the download button counts. */
  count: number;
  /** This world has something to review. Nothing is drawn until the reads land. */
  hasLinkedContent: boolean;
  loading: boolean;
}

/**
 * Read one world listing's linked content: what it requires, and what it is offered as an add-on.
 *
 * Both reads are per listing and are made only while the review is on screen. A server that has never
 * heard of the routes answers nothing, which leaves the section absent rather than wrong.
 *
 * @param world - The listing being looked at, or null when none is open
 * @param enabled - Whether to read at all, so a closed dialog makes no request
 */
export function useWorldDownloadPlan(world: WorldRecord | null, enabled: boolean): WorldDownloadPlan {
  const [dependencies, setDependencies] = useState<DependencyRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [selected, setSelected] = useState<SelectedAddon[]>([]);
  const [loading, setLoading] = useState(false);

  const worldId = world && kindOf(world) === 'world' ? listingId(world) : '';

  useEffect(() => {
    setSelected([]);
    setDependencies([]);
    setAddons([]);
    if (!enabled || !worldId) return;

    let live = true;
    setLoading(true);
    void (async () => {
      // Settled apart rather than awaited together: one route refusing must not blank the other's list.
      // An unreadable set leaves its tab empty here; the download reads both again and refuses rather
      // than installing a world whose required sources it could not resolve.
      const [required, offered] = await Promise.allSettled([
        WorldStorageService.fetchDependencies(worldId),
        WorldStorageService.fetchAddons(worldId),
      ]);
      if (!live) return;
      if (required.status === 'fulfilled') setDependencies(required.value);
      else console.error('Failed to read what this world requires:', required.reason);
      if (offered.status === 'fulfilled') setAddons(offered.value);
      else console.error('Failed to read this world\'s add-ons:', offered.reason);
      setLoading(false);
    })();
    return () => { live = false; };
  }, [worldId, enabled]);

  const toggle = useCallback((addon: SelectedAddon, on: boolean) => {
    setSelected((prev) => {
      const without = prev.filter((held) => held.id !== addon.id);
      return on ? [...without, addon] : without;
    });
  }, []);

  const tabs = useMemo(() => addonTabs(addons), [addons]);
  const plan = useMemo(() => ({ addons: selected }), [selected]);

  return {
    dependencies,
    tabs,
    toggle,
    plan,
    count: downloadItemCount(dependencies, addons, selected.map((addon) => addon.id)),
    hasLinkedContent: dependencies.length > 0 || tabs.approved.length > 0 || tabs.community.length > 0,
    loading,
  };
}
