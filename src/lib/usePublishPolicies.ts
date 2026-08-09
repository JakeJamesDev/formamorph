import { useCallback, useEffect, useRef, useState } from 'react';
import PolicyService from '@/services/PolicyService';
import { isUploadTermsDeclined, setUploadTermsDeclined } from '@/lib/uploadTermsDeclined';
import type { PolicyState } from '@/types';

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
  const [declined, setDeclined] = useState(isUploadTermsDeclined);

  // Counts reads so a reply that arrives after a newer one started, or after the modal closed, is
  // dropped rather than applied: the modal refetches every time it opens, so closing and reopening
  // leaves two in flight, and whichever lands last would otherwise win regardless of which is current.
  const readId = useRef(0);

  const refresh = useCallback(async () => {
    const read = (readId.current += 1);
    const apply = (next: PolicyState | null) => {
      if (read === readId.current) setPolicies(next);
    };

    if (!isAuthenticated) {
      apply(null);
      return;
    }

    try {
      apply(await PolicyService.fetchPolicies());
    } catch (error) {
      // Fail open: no policy state means nothing to show, and the server still refuses if it must.
      console.error('Failed to load publish policies:', error);
      apply(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (open) refresh();
    // Retires the in-flight read on close and on unmount — the latter is what keeps a late reply from
    // setting state on a torn-down component.
    return () => { readId.current += 1; };
  }, [open, refresh]);

  const gate = policies?.uploadGate ?? null;

  /** Whether the gate must be answered before this publish can go ahead. */
  const gateBlocks = Boolean(gate && !gate.accepted);

  const accept = useCallback(async () => {
    await PolicyService.acceptUploadGate();
    setDeclined(false);
    setUploadTermsDeclined(false);
    setPolicies((prev) => (prev?.uploadGate ? { ...prev, uploadGate: { ...prev.uploadGate, accepted: true } } : prev));
  }, []);

  const decline = useCallback(async () => {
    setDeclined(true);
    setUploadTermsDeclined(true);

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
    setUploadTermsDeclined(false);
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
