import { safeNextPath } from './nextPath';
import { useSiteLocation } from './router';

/** Where a page sends the reader when it is done, and how it hands that on to its sibling page. */
export interface NextPath {
  /** An absolute path on this site, filtered. */
  next: string;
  /** The query string that carries `next` to another account page — empty when there is nothing to carry. */
  carry: string;
}

/**
 * Read `?next=` off the address bar.
 *
 * The carry is rebuilt from the filtered value rather than passed on whole, so a sibling page can never
 * inherit a return path this one already refused.
 */
export function useNextPath(): NextPath {
  const { search } = useSiteLocation();
  const next = safeNextPath(new URLSearchParams(search).get('next'));
  return { next, carry: next === '/' ? '' : `?next=${encodeURIComponent(next)}` };
}
