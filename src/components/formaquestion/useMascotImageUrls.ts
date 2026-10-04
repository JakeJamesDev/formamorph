import { useCallback, useEffect, useRef, useState } from 'react';
import type { MascotImageRef } from '@/lib/formaquestion/mascot';
import { mascotAssetUrl } from '@/lib/formaquestion/mascotAssets';
import { getMascotImage } from '@/lib/formaquestion/mascotImageStore';

/**
 * A resolver from a rig image to a URL the browser can draw. A bundled image resolves at once. A stored image
 * resolves to an object URL once its blob is read, and to null until then or when the store lacks it. Each
 * object URL is revoked when its id leaves `refs` and at unmount.
 */
export function useMascotImageUrls(refs: readonly MascotImageRef[]): (ref: MascotImageRef) => string | null {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const owned = useRef(new Map<string, string>());
  const key = [...new Set(refs.flatMap((ref) => (ref.kind === 'stored' ? [ref.id] : [])))].sort().join('\n');

  useEffect(() => {
    const wanted = new Set(key ? key.split('\n') : []);
    let alive = true;
    for (const [id, url] of owned.current) {
      if (wanted.has(id)) continue;
      URL.revokeObjectURL(url);
      owned.current.delete(id);
    }
    // Also drops URLs a remount revoked, so no revoked URL is drawn while the reads run again.
    setUrls(new Map(owned.current));
    for (const id of wanted) {
      if (owned.current.has(id)) continue;
      void getMascotImage(id).then((blob) => {
        // A read that lands after the next run or after unmount creates nothing; the next run reads again.
        if (!alive || !blob) return;
        const url = URL.createObjectURL(blob);
        owned.current.set(id, url);
        setUrls(new Map(owned.current));
      }, (cause: unknown) => console.error('Could not read a mascot image:', cause));
    }
    return () => { alive = false; };
  }, [key]);

  useEffect(() => () => {
    for (const url of owned.current.values()) URL.revokeObjectURL(url);
    owned.current.clear();
  }, []);

  return useCallback((ref) => (ref.kind === 'bundled' ? mascotAssetUrl(ref.name) : urls.get(ref.id) ?? null), [urls]);
}
