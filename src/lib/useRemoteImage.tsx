/**
 * Resolve any stored image value to something an `<img>` can show.
 *
 * An embedded data URL passes straight through. A remote URL is served from the blob cache when it is there,
 * fetched and cached on a miss, and rendered live on any failure — a host that blocks CORS can still be
 * displayed, it just never caches, so the picture works online and is only missing offline.
 */
/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the
   `useRemoteImage` hook with its `<img>` wrapper `RemoteImg`; they're one unit. */
import { forwardRef, useEffect, useState, type ImgHTMLAttributes } from 'react';
import { isRemoteImage } from './imageSource';
import { getCachedImage, putCachedImage } from './remoteImageCache';

/**
 * What is known about where the showing pixels came from.
 *
 * `unreadable` is the one worth surfacing: the picture displays, but its host won't hand the bytes over, so
 * offline, character-card export, and embed-on-export can't work for it. Re-derived on every mount rather
 * than recorded when the link was pasted, so a verdict can't go stale.
 */
export type RemoteStatus = 'embedded' | 'pending' | 'cached' | 'unreadable';

export function useRemoteImage(url: string | null | undefined): { src: string; status: RemoteStatus } {
  const [src, setSrc] = useState(() => (isRemoteImage(url) ? '' : url || ''));
  const [status, setStatus] = useState<RemoteStatus>(() => (isRemoteImage(url) ? 'pending' : 'embedded'));

  useEffect(() => {
    if (!isRemoteImage(url)) { setSrc(url || ''); setStatus('embedded'); return; }

    const remote = url as string;
    let cancelled = false;
    let objectUrl: string | null = null;
    // Render live immediately; a cache hit swaps in behind it rather than blanking the picture first.
    setSrc(remote);
    setStatus('pending');

    (async () => {
      try {
        const cached = await getCachedImage(remote);
        if (cancelled) return;
        if (cached) {
          objectUrl = URL.createObjectURL(cached.blob);
          setSrc(objectUrl);
          setStatus('cached');
          return;
        }
        const response = await fetch(remote);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        if (cancelled) return;
        await putCachedImage(remote, blob);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setStatus('cached');
      } catch {
        // Offline, CORS, or quota — the live URL set above stands, and the picture still shows.
        if (!cancelled) setStatus('unreadable');
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return { src, status };
}

/** Drop-in `<img>` whose `src` resolves through the cache. Everything else forwards untouched, the ref
 *  included — a `<Tip>` composes onto this, and a trigger without a ref has nothing to point at. */
export const RemoteImg = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement> & {
  /** Told where the showing pixels came from, for callers that surface it (the editor's link badge). */
  onStatus?: (status: RemoteStatus) => void;
}>(({ src, onStatus, ...rest }, ref) => {
  const { src: resolved, status } = useRemoteImage(typeof src === 'string' ? src : '');
  useEffect(() => { onStatus?.(status); }, [status, onStatus]);
  return <img ref={ref} src={resolved} {...rest} />;
});
RemoteImg.displayName = 'RemoteImg';
