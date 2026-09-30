/**
 * Prefetch a listing when a reader rests on its card: a pointer that stays on it, or keyboard focus that
 * stays inside it. A sweep or a Tab past the card sends nothing, and touch never prefetches.
 */
import { useEffect, useRef, type FocusEvent, type PointerEvent } from 'react';
import { prefetchListing } from '@/lib/listingDetailsLoader';

/** How long a pointer or keyboard focus rests on a card before its listing loads. */
export const PREFETCH_DWELL_MS = 150;

// Whether the last input was a key, so focus that a tap or click moved is not read as keyboard focus.
let keyboardInput = false;
let tracking = false;
const trackInput = () => {
  if (tracking) return;
  tracking = true;
  document.addEventListener('keydown', () => { keyboardInput = true; }, true);
  document.addEventListener('pointerdown', () => { keyboardInput = false; }, true);
};

export interface ListingPrefetchHandlers {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}

/** Handlers for a card's frame that prefetch its listing after a dwell. */
export function useListingPrefetch(listingId: string): ListingPrefetchHandlers {
  // One dwell per source, so a pointer leaving never cancels a keyboard dwell or the reverse.
  const timers = useRef<Record<'pointer' | 'focus', ReturnType<typeof setTimeout> | null>>({ pointer: null, focus: null });

  const disarm = (source: 'pointer' | 'focus') => {
    const timer = timers.current[source];
    if (timer !== null) clearTimeout(timer);
    timers.current[source] = null;
  };
  const arm = (source: 'pointer' | 'focus') => {
    disarm(source);
    timers.current[source] = setTimeout(() => {
      timers.current[source] = null;
      prefetchListing(listingId);
    }, PREFETCH_DWELL_MS);
  };

  useEffect(trackInput, []);
  useEffect(() => () => { disarm('pointer'); disarm('focus'); }, []);

  return {
    onPointerEnter: (event) => { if (event.pointerType !== 'touch') arm('pointer'); },
    onPointerLeave: () => disarm('pointer'),
    onFocus: () => { if (keyboardInput && timers.current.focus === null) arm('focus'); },
    onBlur: (event) => {
      // Focus moving between controls inside the card keeps it armed.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) disarm('focus');
    },
  };
}
