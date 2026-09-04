import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { PolicyDialog } from '@/components/menu/PolicyDialog';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { watchPrivacyRefusals } from '@/lib/privacyRefusal';
import { useAccountDeletion } from '@/contexts/AccountDeletionContext';
import { useDevRoute } from '@/lib/devRouter';
import { DEV_PRIVACY_SAMPLE } from '@/lib/devPrivacySample';
import AuthService from '@/services/AuthService';
import PolicyService from '@/services/PolicyService';
import type { AnswerablePolicy } from '@/types';

interface PrivacyPolicyValue {
  /** Whether the prompt is on screen. Other blocking dialogs hold themselves back while it is. */
  promptOpen: boolean;
  /** Re-read the policy and prompt if this account has not accepted it. Called after a sign-in. */
  checkNow: () => Promise<void>;
}

const PrivacyPolicyContext = createContext<PrivacyPolicyValue | null>(null);

/**
 * The Privacy Policy prompt every signed-in account meets once.
 *
 * The server refuses every authenticated route until the account accepts, so this asks at the three
 * moments that refusal can first bite: boot with a session already held, the moment after a sign-in, and
 * any request that comes back refused. All three end in the same prompt.
 *
 * Above the view switch, because a refusal can answer a request made from either screen, and because the
 * boot pass runs before anything is opened. Below the age gate, and silent until it is answered: a held
 * token keeps reading the community server whether or not anybody opened anything, which is the reading
 * the attestation exists to stop.
 *
 * There are three ways out and all of them are buttons. Accepting records the answer and closes. Signing
 * out ends the session and does nothing else — the account stays exactly as it was, free to sign in and
 * accept later. Deleting the account opens the deletion flow over this prompt, because an account that
 * will not accept the policy still needs a way to leave.
 */
export function PrivacyPolicyProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<AnswerablePolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const devRoute = useDevRoute();
  const { startDeletion } = useAccountDeletion();
  const { attested } = useAgeGate();

  // One read at a time: the refusal watch fires per refused request, and a screen that makes several at
  // once would otherwise start a read for each. A request arriving mid-read is remembered rather than
  // dropped — the one that matters is often exactly the one that raced an already-stale read.
  const reading = useRef(false);
  const again = useRef(false);

  const checkNow = useCallback(async () => {
    if (!COMMUNITY_ENABLED || !attested || !AuthService.isAuthenticated()) return;

    // Re-entry, not a queue: this is what keeps a refused read of the policies route itself from
    // looping. The remembered pass runs after the current one returns, never inside it.
    if (reading.current) {
      again.current = true;
      return;
    }

    reading.current = true;

    try {
      const state = await PolicyService.fetchPolicies();
      // Absent whenever the policy is switched off, which is how it ships: nothing to ask, and the
      // server is refusing nothing either. An older server omits the field entirely, which reads the same.
      const privacy = state.privacyPolicy ?? null;
      setPolicy(privacy && !privacy.accepted ? privacy : null);
    } catch (error) {
      // Reading it is not what enforces it. A failure here leaves the prompt closed and the server
      // still refusing, which surfaces as the plain message rather than a wrongly-raised dialog.
      console.error('Failed to read the privacy policy:', error);
    } finally {
      reading.current = false;
    }

    if (again.current) {
      again.current = false;
      await checkNowRef.current();
    }
  }, [attested]);

  // The repeat pass calls through a ref so the callback does not have to name itself, which would
  // make its identity change on every render and reinstall the fetch watch with it.
  const checkNowRef = useRef(checkNow);
  checkNowRef.current = checkNow;

  // The boot pass runs once, on the first render where the player has attested — which is the mount
  // itself for a returning player, and the moment they answer for a new one. In StrictMode the effect
  // runs twice, and the second pass would read again for nothing.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current || !attested) return;
    booted.current = true;
    void checkNow();
  }, [attested, checkNow]);

  // Any refused request raises the same prompt, wherever it was made from. The policy routes themselves
  // are exempt server-side, so the read this schedules cannot be refused in turn.
  useEffect(() => {
    if (!COMMUNITY_ENABLED) return;
    return watchPrivacyRefusals(AuthService.API_URL, () => { void checkNow(); });
  }, [checkNow]);

  // Signing out anywhere — here, the profile dialog, or a 401 — drops a prompt that no longer applies.
  useEffect(() => AuthService.onSessionEnded(() => setPolicy(null)), []);

  // DEV: `#dev?modal=privacyPolicy` raises the prompt on canned text, so its copy stays checkable
  // against a server whose policy is still switched off.
  useEffect(() => {
    if (import.meta.env.DEV && COMMUNITY_ENABLED && devRoute?.modal === 'privacyPolicy') {
      setPolicy(DEV_PRIVACY_SAMPLE);
    }
  }, [devRoute?.modal]);

  const accept = useCallback(async () => {
    setBusy(true);
    try {
      await PolicyService.acceptPrivacyPolicy();
      setPolicy(null);
    } catch (error) {
      // Left open on failure: closing it would strand the account, still refused, with nothing on screen.
      toast.error((error as Error).message || 'Failed to record your acceptance');
    } finally {
      setBusy(false);
    }
  }, []);

  // Ends the session and nothing else. The account keeps everything it had, including the chance to
  // accept at the next sign-in.
  const signOut = useCallback(() => {
    setPolicy(null);
    AuthService.logout();
    // The header's own sign-out says so; this one follows a dialog the player did not open, so saying
    // nothing would leave them on a signed-out menu with no account of how they got there.
    toast.info('Signed out. Your account is unchanged — accept the policy next time to carry on.');
  }, []);

  const value = useMemo(() => ({ promptOpen: policy !== null, checkNow }), [policy, checkNow]);

  return (
    <PrivacyPolicyContext.Provider value={value}>
      {children}
      {COMMUNITY_ENABLED && policy && (
        <PolicyDialog
          open
          title={policy.title}
          body={policy.body}
          confirmLabel="Accept"
          cancelLabel="Sign Out"
          onConfirm={() => { void accept(); }}
          onCancel={signOut}
          // Left open behind the flow: backing out of the deletion returns to the answer still owed.
          extraLabel="Delete My Account"
          onExtra={startDeletion}
          busy={busy}
        />
      )}
    </PrivacyPolicyContext.Provider>
  );
}

/**
 * The Privacy Policy prompt.
 *
 * Throws without a provider above rather than answering "nothing to ask": a sign-in path that quietly
 * lost its prompt would leave the account refused by the server with no way to answer.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function usePrivacyPolicy(): PrivacyPolicyValue {
  const value = useContext(PrivacyPolicyContext);
  if (!value) throw new Error('usePrivacyPolicy must be used within a PrivacyPolicyProvider');
  return value;
}
