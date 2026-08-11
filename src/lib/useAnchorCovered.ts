import { useEffect, useState } from 'react';

/**
 * Whether a modal has been layered over the element, hiding it from the reader.
 *
 * A Radix dialog marks everything outside itself `aria-hidden` (older browsers) or `inert`, so an
 * ancestor carrying either means the element is on screen but unreachable. Content portaled to
 * `<body>` — a popover anchored to that element — is not marked, so it goes on floating above the
 * dialog with nothing left to point at. Watching the flag is what lets it stand down instead.
 *
 * Only observes while `watching`, so nothing is listening once whatever needed it is gone.
 */
export function useAnchorCovered(anchor: HTMLElement | null, watching: boolean): boolean {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    if (!anchor || !watching) { setCovered(false); return; }

    const check = () => setCovered(
      Boolean(anchor.closest('[aria-hidden="true"]')) || Boolean(anchor.closest('[inert]')),
    );
    check();

    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'inert'],
    });
    return () => observer.disconnect();
  }, [anchor, watching]);

  return covered;
}
