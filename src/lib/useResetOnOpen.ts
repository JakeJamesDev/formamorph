import { useLayoutEffect } from 'react';

/**
 * Run `reset` when `open` transitions to `true`, synchronously before the browser paints.
 *
 * Reset a dialog/popup's local state on OPEN, never on close. Clearing it in the close handler reverts the
 * still-visible content to its initial state for a frame or two while the popup fades out (the exit
 * animation keeps it mounted). Resetting on open is invisible — the popup isn't shown yet — and leaves the
 * closing content untouched, so there's no flash.
 */
export function useResetOnOpen(open: boolean, reset: () => void): void {
  useLayoutEffect(() => {
    if (open) reset();
    // `reset` is intentionally not a dependency: fire only on the open transition (using the latest reset),
    // not on every render — which would re-clear the form as the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
