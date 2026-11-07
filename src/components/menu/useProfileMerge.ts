import { useCallback, useEffect, useRef, useState } from 'react';
import { useMountedRef } from '@/lib/useMountedRef';
import {
  applyMerge,
  planIsEmpty,
  planMerge,
  reasonOf,
  snapshotsOf,
  type CategoryPlan,
  type MergeCategory,
} from '@/lib/profileMerge/engine';
import type { MergeMarker, ProfileMergeBridge } from '@/lib/profileMerge/bridge';
import type { ProfileMergeView } from './profileMergeView';

interface UseProfileMergeOptions {
  /** Null outside the desktop build, or to keep the offer off (a dev route showing a sample). */
  bridge: ProfileMergeBridge | null;
  categoriesOf: (bridge: ProfileMergeBridge) => MergeCategory[];
  /** Re-read the menu's lists after a merge. */
  onMerged: () => void;
}

const markQuietly = (bridge: ProfileMergeBridge, state: MergeMarker, categories?: string[]) =>
  bridge.mark(state, categories).catch((err: unknown) => console.error(`[profile merge] ${state} marker failed:`, err));

const keysOf = (list: MergeCategory[]) => list.map((category) => category.key);

/** The merge offer on a launcher start: detection, the plan, the locked run and the markers. */
export function useProfileMerge({ bridge, categoriesOf, onMerged }: UseProfileMergeOptions) {
  const mounted = useMountedRef();
  const [view, setView] = useState<ProfileMergeView | null>(null);
  const categories = useRef<MergeCategory[]>([]);
  const onMergedRef = useRef(onMerged);
  onMergedRef.current = onMerged;

  useEffect(() => {
    if (!bridge) return;
    let canceled = false;
    void (async () => {
      try {
        const offer = await bridge.offer();
        if (!offer || canceled) return;
        const list = categoriesOf(bridge).filter((category) => !offer.merged.includes(category.key));
        if (!list.length) return;
        const { source, target } = await snapshotsOf(list);
        if (canceled) return;
        const plans = planMerge(list, source, target);
        if (planIsEmpty(plans)) {
          await markQuietly(bridge, 'done', keysOf(list));
          return;
        }
        categories.current = list;
        if (mounted.current) setView({ step: 'offer', plans });
      } catch (err) {
        console.error('[profile merge] offer failed:', err);
        void bridge.later().catch(() => {});
      }
    })();
    return () => { canceled = true; };
  }, [bridge, categoriesOf, mounted]);

  const merge = useCallback(async () => {
    if (!bridge || view?.step !== 'offer') return;
    const plans: CategoryPlan[] = view.plans;
    setView({ step: 'run', plans, progress: {} });
    try {
      const results = await applyMerge(plans, categories.current, (progress) => {
        if (!mounted.current) return;
        setView((prev) => (prev?.step === 'run' ? { ...prev, progress: { ...prev.progress, [progress.key]: progress } } : prev));
      });
      // A marker that fails to save only brings the offer back, and a repeat run keeps every copied item.
      await markQuietly(bridge, 'done', keysOf(categories.current));
      if (mounted.current) setView({ step: 'result', results });
    } catch (err) {
      void bridge.later().catch(() => {});
      if (mounted.current) setView({ step: 'result', results: [], error: reasonOf(err).replace(/\.$/, '') });
    }
    if (mounted.current) onMergedRef.current();
  }, [bridge, view, mounted]);

  const notNow = useCallback(() => {
    setView(null);
    void bridge?.later().catch(() => {});
  }, [bridge]);

  const decline = useCallback(() => {
    setView(null);
    if (bridge) void markQuietly(bridge, 'declined');
  }, [bridge]);

  const done = useCallback(() => setView(null), []);

  const restart = useCallback(() => {
    if (bridge) void bridge.restart().catch((err: unknown) => console.error('[profile merge] restart failed:', err));
  }, [bridge]);

  return { view, merge, notNow, decline, done, restart };
}
