/**
 * Resolve any stored image value to something an `<img>` can show.
 *
 * An embedded data URL passes straight through. A remote URL is served from the blob cache when it is there,
 * fetched and cached on a miss, and rendered live on any failure — a host that blocks CORS can still be
 * displayed, it just never caches, so the picture works online and is only missing offline.
 */
/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the
   `useRemoteImage` hook with its `<img>` wrapper `RemoteImg`; they're one unit. */
import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { isRemoteImage } from './imageSource';
import { getCachedImage, putCachedImage } from './remoteImageCache';

export function useRemoteImage(url: string | null | undefined): string {
  const [src, setSrc] = useState(() => (isRemoteImage(url) ? '' : url || ''));

  useEffect(() => {
    if (!isRemoteImage(url)) { setSrc(url || ''); return; }

    const remote = url as string;
    let cancelled = false;
    let objectUrl: string | null = null;
    // Render live immediately; a cache hit swaps in behind it rather than blanking the picture first.
    setSrc(remote);

    (async () => {
      try {
        const cached = await getCachedImage(remote);
        if (cancelled) return;
        if (cached) {
          objectUrl = URL.createObjectURL(cached.blob);
          setSrc(objectUrl);
          return;
        }
        const response = await fetch(remote);
        if (!response.ok) return;
        const blob = await response.blob();
        if (cancelled) return;
        await putCachedImage(remote, blob);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        /* offline, CORS, or quota — the live URL set above stands */
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src;
}

/** Drop-in `<img>` whose `src` resolves through the cache. Everything else forwards untouched. */
export function RemoteImg({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const resolved = useRemoteImage(typeof src === 'string' ? src : '');
  return <img src={resolved} {...rest} />;
}
