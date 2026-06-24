import { useEffect, useState } from 'react';
import { getThumb, putThumb, toEpoch } from './thumbnailCache';

/**
 * Resolve a world thumbnail to a displayable src, served from the IndexedDB blob cache when
 * possible. Fetches (and caches) the image only on a miss or when `updatedAt` is newer than the
 * cached copy; falls back to the direct `url` on any error so images never break.
 */
function useCachedThumbnail(
  file: string | null | undefined,
  url: string,
  updatedAt: string | number | null | undefined,
): { src: string; loading: boolean } {
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) { setSrc(url || ''); return; }

    let cancelled = false;
    let objectUrl: string | null = null;
    const wantEpoch = toEpoch(updatedAt);
    setLoading(true);

    (async () => {
      try {
        const cached = await getThumb(file);
        if (cancelled) return;
        if (cached && cached.updatedAt >= wantEpoch) {
          objectUrl = URL.createObjectURL(cached.blob);
          setSrc(objectUrl);
          return;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`thumbnail ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        await putThumb(file, blob, wantEpoch);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(url); // network/CORS/quota error → render directly from server
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, url, updatedAt]);

  return { src, loading };
}

/** Ergonomic <img> that resolves its source through the thumbnail cache. Renders nothing
 *  until a real src is ready, so the parent's placeholder shows instead of a broken-image icon. */
export function CachedThumbnail({ file, url, updatedAt, alt, className }: {
  file: string | null | undefined;
  url: string;
  updatedAt: string | number | null | undefined;
  alt: string;
  className?: string;
}) {
  const { src } = useCachedThumbnail(file, url, updatedAt);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}
