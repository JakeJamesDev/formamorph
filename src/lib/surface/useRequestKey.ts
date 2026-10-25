import { useRef } from 'react';

/**
 * The last surface request key this component saw. It never returns to undefined, so an effect keyed on it
 * runs for each new request but not when the landing clears, which would undo the user's own pick.
 */
export function useRequestKey(requestKey: string | undefined): string | undefined {
  const last = useRef(requestKey);
  if (requestKey !== undefined) last.current = requestKey;
  return last.current;
}
