import { useEffect, useState } from 'react';
import type { VrmLicense } from '@/types';

/** A model's bytes and the license read from them. */
export interface HeldModel {
  blob: Blob;
  license?: VrmLicense;
}

/**
 * Holds a model's bytes as an object URL while `load` is set, and revokes it when `load` changes or the view
 * unmounts. A VRM runs to tens of megabytes, so nothing outlives the view. Callers memoize `load`.
 */
export function useHeldModelBlob(load: (() => Promise<HeldModel>) | null) {
  const [url, setUrl] = useState<string | undefined>();
  const [held, setHeld] = useState<HeldModel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    setFailed(false);
    load()
      .then((loaded) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(loaded.blob);
        setUrl(objectUrl);
        setHeld(loaded);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
      setHeld(null);
    };
  }, [load]);

  return { url, blob: held?.blob ?? null, license: held?.license, failed };
}
