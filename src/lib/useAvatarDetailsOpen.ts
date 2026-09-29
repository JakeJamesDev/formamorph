import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'fm-avatar-details-open';
const CHANGE_EVENT = 'fm-avatar-details-open';

/**
 * Whether the Avatar details table is open. One state for every surface that shows the panel, kept per
 * device. Starts collapsed so the 3D preview gets the room; an unreadable store reads as collapsed.
 */
export function useAvatarDetailsOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onChange = (e: Event) => setOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const update = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // A blocked store costs only persistence; this session still honors the choice.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }, []);

  return [open, update];
}
