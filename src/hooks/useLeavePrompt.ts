import { useEffect } from 'react';

/** Shows the browser's leave prompt on tab close or reload while `active`. The listener goes when `active` clears or the caller unmounts. */
export function useLeavePrompt(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers read this instead of preventDefault.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}
