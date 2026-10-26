import { useEffect, useState } from 'react';
import ReviewService from '@/services/ReviewService';
import { useMountedRef } from '@/lib/useMountedRef';

/** What the held thumbnail read has so far: an object URL, or why there is none. */
export type PendingThumbnail =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; src: string }
  | { status: 'failed' };

/**
 * The held thumbnail at `url`, read with the Bearer token and shown through an object URL.
 * The URL is revoked when `url` changes or the reader unmounts.
 */
export function usePendingThumbnail(url: string | undefined): PendingThumbnail {
  const [state, setState] = useState<PendingThumbnail>({ status: url ? 'loading' : 'none' });
  const mounted = useMountedRef();

  useEffect(() => {
    if (!url) {
      setState({ status: 'none' });
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    setState({ status: 'loading' });

    ReviewService.fetchPendingThumbnail(url, controller.signal).then((blob) => {
      if (!mounted.current || controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ status: 'ready', src: objectUrl });
    }, () => {
      if (mounted.current && !controller.signal.aborted) setState({ status: 'failed' });
    });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, mounted]);

  return state;
}
