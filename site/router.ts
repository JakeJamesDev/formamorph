import { useEffect, useState } from 'react';

/**
 * The site's routing, small enough to read in one sitting.
 *
 * Every account route is served the same document, so the entry decides what to render from the
 * address bar. Links between the pages are ordinary hrefs — a full load, which is what the landing page
 * and `/play/` need in order to re-read the session — so the only move to follow here is the browser's
 * own Back.
 */

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
