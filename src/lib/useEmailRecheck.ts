import { useCallback, useEffect, useRef } from 'react';
import AuthService from '@/services/AuthService';

export type EmailState = NonNullable<Awaited<ReturnType<typeof AuthService.fetchEmailState>>>;

/** How long after a send the account is read again; a refusal from a dead address is back by then. */
export const RECHECK_DELAY_MS = 5000;

/**
 * Keeps an email section current with what happened to its mail: reads the account again shortly after
 * a send, and whenever the window comes back into view.
 *
 * `drop` discards a pending or running read, for a write that changes the account.
 */
export function useEmailRecheck(onFresh: (fresh: EmailState) => void): { recheckSoon: () => void; drop: () => void } {
  const generation = useRef(0);
  const reading = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handler = useRef(onFresh);

  useEffect(() => { handler.current = onFresh; });

  const read = useCallback(() => {
    if (reading.current) return;
    reading.current = true;
    const started = generation.current;

    void AuthService.fetchEmailState().then((fresh) => {
      // A drop also releases the guard, so only the read it left running may clear it.
      if (generation.current !== started) return;
      reading.current = false;
      if (fresh) handler.current(fresh);
    });
  }, []);

  const drop = useCallback(() => {
    generation.current += 1;
    reading.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const recheckSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      read();
    }, RECHECK_DELAY_MS);
  }, [read]);

  useEffect(() => {
    const onReturn = () => { if (document.visibilityState === 'visible') read(); };

    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);

    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      drop();
    };
  }, [read, drop]);

  return { recheckSoon, drop };
}
