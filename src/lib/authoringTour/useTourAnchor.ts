import { useEffect, useState } from 'react';

/** The attribute a tour step points at. It sits on the field's own wrapper. */
export const TOUR_ANCHOR_ATTR = 'data-tour-anchor';

export function findTourAnchor(anchor: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${TOUR_ANCHOR_ATTR}="${anchor}"]`);
}

/**
 * The element carrying this tour anchor, followed as it mounts and unmounts. The whole document is watched,
 * because a field can move into a portaled full-screen shell.
 */
export function useTourAnchor(anchor: string | null): HTMLElement | null {
  const [element, setElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!anchor) { setElement(null); return; }
    const find = () => setElement(findTourAnchor(anchor));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [anchor]);
  return element;
}
