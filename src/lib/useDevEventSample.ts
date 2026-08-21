import { useEffect, useState } from 'react';

type DevEventSampleModule = typeof import('@/lib/devEventSample');

/**
 * DEV: the canned events module, loaded on demand by whichever surface a dev route aimed at.
 *
 * The four surfaces built on events each need a stand-in for the network — the banner and its poster,
 * the contest tab, the publish opt-in, the admin calendar — and each was reaching for the same import
 * behind the same flag. One hook owns it so the gating cannot drift between them.
 *
 * The `import.meta.env.DEV` check is here rather than only in the callers: it folds to `false` in a
 * production build, which takes the whole branch and its dynamic import with it.
 *
 * @param enabled - Whether a dev route is asking for the fixture; false while a real session runs
 * @returns The module once it lands, null before that and always outside DEV
 */
export function useDevEventSample(enabled: boolean): DevEventSampleModule | null {
  const [samples, setSamples] = useState<DevEventSampleModule | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV || !enabled || samples) return;

    let current = true;
    void import('@/lib/devEventSample').then((loaded) => { if (current) setSamples(loaded); });
    return () => { current = false; };
  }, [enabled, samples]);

  return import.meta.env.DEV && enabled ? samples : null;
}
