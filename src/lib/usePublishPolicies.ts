import { useCallback, useEffect, useState } from 'react';
import PolicyService from '@/services/PolicyService';
import type { PolicyState } from '@/types';

/** Declining is remembered locally as well as on the server, so the short blocked notice survives a
 *  reload even if the server call didn't land. */
const DECLINED_KEY = 'FORMAMORPH_uploadTermsDeclined';

const readDeclined = (): boolean => {
  try {
    return localStorage.getItem(DECLINED_KEY) === '1';
  } catch {
    return false; // private mode — just don't remember it
  }
};

const writeDeclined = (declined: boolean) => {
  try {
    if (declined) localStorage.setItem(DECLINED_KEY, '1');
    else localStorage.removeItem(DECLINED_KEY);
  } catch { /* private mode — the dialog simply reappears next time */ }
};

/**
 * Policy state for the publish flow: whether a gate applies, whether this user has cleared it, and the
 * authored text of both popups.
 *
 * Fails open on every error. The gate is enforced by the server, so a client that cannot read policy
 * state must let the publish proceed and be refused there — blocking locally would stop everyone from
 * publishing whenever this one endpoint hiccups.
 *
 * @param open - Whether the publish modal is open; state is fetched each time it opens
 * @param isAuthenticated - Signed-out users never see a policy
 */
export function usePublishPolicies(open: boolean, isAuthenticated: boolean) {
  const [policies, setPolicies] = useState<PolicyState | null>(null);
  const [declined, setDeclined] = useState(readDeclined);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setPolicies(null);
      return;
    }

    try {
      setPolicies(await PolicyService.fetchPolicies());
    } catch (error) {
      // Fail open: no policy state means nothing to show, and the server still refuses if it must.
      console.error('Failed to load publish policies:', error);
      setPolicies(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const gate = policies?.uploadGate ?? null;

  /** Whether the gate must be answered before this publish can go ahead. */
  const gateBlocks = Boolean(gate && !gate.accepted);

  const accept = useCallback(async () => {
    await PolicyService.acceptUploadGate();
    setDeclined(false);
    writeDeclined(false);
    setPolicies((prev) => (prev?.uploadGate ? { ...prev, uploadGate: { ...prev.uploadGate, accepted: true } } : prev));
  }, []);

  const decline = useCallback(async () => {
    setDeclined(true);
    writeDeclined(true);

    // The refusal is only a record for the admin table — an unanswered gate blocks just the same — so a
    // failure here must not stop the local state from taking effect.
    try {
      await PolicyService.declineUploadGate();
    } catch (error) {
      console.error('Failed to record the declined terms:', error);
    }
  }, []);

  /** Clear the local refusal so the gate is offered again rather than the blocked notice. */
  const reopen = useCallback(() => {
    setDeclined(false);
    writeDeclined(false);
  }, []);

  return {
    gate,
    tagNotice: policies?.tagNotice ?? null,
    gateBlocks,
    /** Show the short blocked notice instead of the full popup: they've already read it and refused. */
    showBlockedNotice: gateBlocks && declined,
    accept,
    decline,
    reopen,
    refresh,
  };
}
