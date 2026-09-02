/* eslint-disable react-refresh/only-export-components -- this module intentionally co-locates the
   `useCachedThumbnail` hook with its one-line `<img>` wrapper `CachedThumbnail`; they're one unit. */
import { useEffect, useRef, useState } from 'react';
import {
  peekThumb, pendingThumb, preloadThumbs, rememberThumb, touchThumb, getThumb, putThumb, toEpoch,
} from './thumbnailCache';
import { THUMB_INTRINSIC, type ThumbAspect } from './thumbAspect';

/**
 * Resolve a world thumbnail to a displayable src.
 *
 * A thumbnail already resolved this session answers on the first render, with no effect and no
 * database open. Past that the blob cache answers, and only past that the network. Anything that
 * fails resolves to nothing, so the card shows its own placeholder.
 */
export function useCachedThumbnail(
  file: string | null | undefined,
  url: string,
  updatedAt: string | number | null | undefined,
): { src: string; loading: boolean } {
  const wantEpoch = toEpoch(updatedAt);
  const key = file ? `${file}@${wantEpoch}` : '';

  // The synchronous hit: the session's URL is state's initial value, so the image paints on the
  // first frame rather than after an effect has opened a database.
  const remembered = file ? peekThumb(file, wantEpoch) : null;
  const [resolved, setResolved] = useState<{ key: string; src: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const src = remembered
    ?? (file ? (resolved?.key === key ? resolved.src : '') : (url || ''));

  useEffect(() => {
    // Recency is recorded here rather than during render: the map is a store, and render must not
    // write to one. Either early return also clears a flag left standing by a fetch this render
    // cancelled — the picture in hand is not still loading.
    if (!file) { setLoading(false); return; }
    if (peekThumb(file, wantEpoch)) { touchThumb(file); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // A batch read covering this file is already open; wait for that one transaction.
        const batch = pendingThumb(file);
        if (batch) {
          await batch;
          if (cancelled) return;
          const primed = peekThumb(file, wantEpoch);
          if (primed) { setResolved({ key, src: primed }); return; }
        }

        const cached = await getThumb(file);
        if (cancelled) return;

        let blob = cached && cached.updatedAt >= wantEpoch ? cached.blob : null;
        if (!blob) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`thumbnail ${res.status}`);
          blob = await res.blob();
          if (cancelled) return;
          await putThumb(file, blob, wantEpoch);
          if (cancelled) return;
        }
        setResolved({ key, src: rememberThumb(file, blob, wantEpoch) });
      } catch {
        if (!cancelled) setResolved({ key, src: '' }); // the card's placeholder, not a broken picture
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [file, url, wantEpoch, key]);

  return { src, loading };
}

/**
 * Read a page of thumbnails in one transaction, before its cards mount.
 *
 * Deliberately runs during render rather than in an effect: a child's effect fires before its
 * parent's, so an effect here would always lose the race to the cards it is meant to spare. The
 * work it starts is a cache warm — idempotent, and holding no React state.
 */
export function useThumbnailPreload(items: { file: string | null | undefined; updatedAt: string | number | null | undefined }[]): void {
  const warmed = useRef('');
  const page = items.map((i) => `${i.file ?? ''}@${toEpoch(i.updatedAt)}`).join('|');
  if (page !== warmed.current) {
    warmed.current = page;
    void preloadThumbs(items
      .filter((i): i is typeof i & { file: string } => Boolean(i.file))
      .map((i) => ({ file: i.file, updatedAt: toEpoch(i.updatedAt) })));
  }
}

/** Ergonomic <img> that resolves its source through the thumbnail cache. Renders nothing
 *  until a real src is ready, so the parent's placeholder shows instead of a broken-image icon. */
export function CachedThumbnail({ file, url, updatedAt, alt, className, aspect = 'landscape' }: {
  file: string | null | undefined;
  url: string;
  updatedAt: string | number | null | undefined;
  alt: string;
  className?: string;
  /** The frame this thumbnail sits in, which gives the image its intrinsic size. */
  aspect?: ThumbAspect;
}) {
  const { src } = useCachedThumbnail(file, url, updatedAt);
  if (!src) return null;
  const { width, height } = THUMB_INTRINSIC[aspect];
  return <img src={src} alt={alt} className={className} width={width} height={height} decoding="async" />;
}
