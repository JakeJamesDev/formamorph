import { useEffect, useState } from 'react';
import ReportService from '@/services/ReportService';

/**
 * The answer, once per session.
 *
 * Whether the server takes reports is a fact about the deployment, not about the reader or the thing
 * being looked at — so asking again per listing, per comment and per profile would be one round trip per
 * control on screen for an answer that cannot have changed. Not cleared on sign-out either: the next
 * account signs in to the same server, which gives the same answer.
 *
 * Only a *definite* answer is kept. A 401 on a retired token or a dropped connection is the question
 * going unanswered, and caching that would hide every report control for the rest of the session — most
 * painfully right after the sign-in that fixed it.
 */
let cached: boolean | null = null;

/** The ask currently in flight, so ten controls mounting at once share one request. */
let inFlight: Promise<boolean> | null = null;

/**
 * Ask the server whether it takes reports, at most once for a settled answer.
 *
 * @returns Whether report controls should be offered
 */
async function reportsSupported(): Promise<boolean> {
  if (cached !== null) return cached;

  inFlight ??= ReportService.fetchMeta().then((meta) => {
    inFlight = null;
    // `undefined` is "could not tell" — left uncached, so the next surface to mount asks again.
    if (meta === undefined) return false;

    cached = meta !== null;
    return cached;
  }).catch(() => {
    inFlight = null;
    return false;
  });

  return inFlight;
}

/**
 * Whether to show report controls at all.
 *
 * False until the answer arrives, and false forever against a server that has never heard of reports —
 * the client and the community server ship separately, and this one is somebody else's live deployment,
 * so a control that would 404 must never appear. False for a signed-out visitor too: reporting needs an
 * account, and offering the action to somebody who cannot take it is worse than not offering it.
 *
 * @param isAuthenticated - Whether somebody is signed in
 * @returns Whether the surface should offer a Report control
 */
export function useReportsEnabled(isAuthenticated: boolean): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setEnabled(false);
      return;
    }

    let current = true;
    void reportsSupported().then((supported) => { if (current) setEnabled(supported); });

    return () => { current = false; };
  }, [isAuthenticated]);

  return enabled;
}
