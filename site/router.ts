import { useEffect, useState } from 'react';

/**
 * The site's routing, small enough to read in one sitting.
 *
 * Every account route is served the same document, so the entry decides what to render from the
 * address bar. Links between the pages are ordinary hrefs — a full load, which is what the landing page
 * and `/play/` need in order to re-read the session — so the only move to follow here is the browser's
 * own Back.
 */

/** A profile path and the name in it. The name runs to the next slash, so nothing nested matches. */
const PROFILE_PATH = /^\/u\/([^/]+)$/;

/**
 * The username in a `/u/<name>` path, or null when the path is not one.
 *
 * Decoded, because the address bar holds the escaped form and every use of it — the fetch, the heading —
 * wants the name as it was typed.
 *
 * @param pathname - The path, already normalized
 */
export function profileUsername(pathname: string): string | null {
  const name = PROFILE_PATH.exec(pathname)?.[1];
  if (!name) return null;

  try {
    return decodeURIComponent(name) || null;
  } catch {
    // A lone `%` is not a name anybody has; the caller draws its not-found for it.
    return null;
  }
}

/** Where the reader is: the path that picks the page, and the query that configures it. */
export interface SiteLocation {
  pathname: string;
  search: string;
}

const currentLocation = (): SiteLocation => ({
  pathname: window.location.pathname,
  search: window.location.search,
});

/** The current location, re-read on Back. */
export function useSiteLocation(): SiteLocation {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const read = () => {
      const next = currentLocation();
      // Held when nothing moved, so a re-render elsewhere does not cascade through every reader.
      setLocation((held) =>
        held.pathname === next.pathname && held.search === next.search ? held : next);
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  return location;
}
