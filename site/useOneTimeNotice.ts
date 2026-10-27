import { useEffect, useState } from 'react';

/**
 * Reads a navigation-scoped notice once, at first render, and clears it after render.
 *
 * Clearing in an effect keeps React's development double-render from consuming the notice before it is visible.
 *
 * @param read - Returns the notice, or a falsy value when none is owed
 * @param clear - Marks the notice shown; pass a stable function
 */
export function useOneTimeNotice<T>(read: () => T, clear: () => void): T {
  const [notice] = useState(read);

  useEffect(() => {
    if (notice) clear();
  }, [notice, clear]);

  return notice;
}
