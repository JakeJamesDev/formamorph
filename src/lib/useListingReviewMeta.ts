import { useEffect, useState } from 'react';
import ReviewService, { type ReviewMeta } from '@/services/ReviewService';
import { useMountedRef } from '@/lib/useMountedRef';

/** What a view knows about listing review on this server. */
export interface ListingReviewMeta {
  /** Whether the server has review at all. False until the answer arrives. */
  supported: boolean;
  /** Whether new submissions wait for review right now. */
  enabled: boolean;
}

const UNKNOWN: ListingReviewMeta = { supported: false, enabled: false };

/** The settled answer for this session. A transient failure is never cached. */
let cached: ListingReviewMeta | null = null;

/** The ask in flight, so surfaces that mount together share one request. */
let inFlight: Promise<ListingReviewMeta> | null = null;

const toMeta = (meta: ReviewMeta | null): ListingReviewMeta =>
  meta ? { supported: true, enabled: meta.enabled } : UNKNOWN;

/** Ask the server once for a settled answer. */
function loadMeta(): Promise<ListingReviewMeta> {
  if (cached) return Promise.resolve(cached);

  inFlight ??= ReviewService.fetchMeta().then((meta) => {
    inFlight = null;
    if (meta === undefined) return UNKNOWN;

    cached = toMeta(meta);
    return cached;
  });

  return inFlight;
}

/** Whether this server has listing review, and whether it is on. All false until the answer arrives. */
export function useListingReviewMeta(): ListingReviewMeta {
  const [meta, setMeta] = useState<ListingReviewMeta>(() => cached ?? UNKNOWN);
  const mounted = useMountedRef();

  useEffect(() => {
    void loadMeta().then((next) => { if (mounted.current) setMeta(next); });
  }, [mounted]);

  return meta;
}
