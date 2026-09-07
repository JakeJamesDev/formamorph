import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AgeGateDialog } from '@/components/community/AgeGateDialog';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { AGE_GATE_VERSION, acceptAgeGate, isAgeAttested } from '@/lib/ageGate';
import { purgeCommunityCaches } from '@/lib/communityCaches';
import { useDevRoute } from '@/lib/devRouter';
import AuthService from '@/services/AuthService';
import AgeGateService from '@/services/AgeGateService';
import {
  beginAgeGateAuthentication,
  bindAgeGateAuthentication,
  cancelAgeGateAuthentication,
  completeAgeGateAuthentication,
} from '@/lib/ageGateAuthentication';
import type { AgeGateAuthenticationFlow, BoundAgeGateAuthentication } from '@/types';

/** What a surface wants done once the player has answered. */
export interface AttestationRequest {
  /** Run once the player attests — immediately, when they already have. */
  onAccept?: () => void;
  /** Run when they refuse. The calling surface closes itself here. */
  onDecline?: () => void;
}

interface AgeGateValue {
  /** Whether the player has attested to the gate as it currently reads. Always true without community. */
  attested: boolean;
  /** Whether the gate is on screen. Other blocking dialogs hold themselves back while it is. */
  gateOpen: boolean;
  /** Ask for the attestation before opening something behind it. */
  requireAttestation: (request?: AttestationRequest) => void;
  /** Ask before opening authentication and retain only an answer made for that flow. */
  requireAuthentication: (request: AttestationRequest) => void;
  /** Bind completed authentication, then optionally begin resolving its account answer. */
  authenticationSucceeded: (onAcceptanceResolved?: () => void) => void;
  /** Resume a deferred account answer after signup Privacy recovery succeeds. */
  authenticationPrivacyResolved: () => void;
  /** Drop an unanswered authentication flow when its dialog closes. */
  authenticationAbandoned: () => void;
}

const AgeGateContext = createContext<AgeGateValue | null>(null);

type GateState = 'accepted' | 'checking' | 'failed' | 'idle' | 'prompt';

const sessionKey = () => `${AuthService.token ?? ''}:${AuthService.currentUser?.id ?? ''}`;

const initialState = (): GateState => {
  if (!COMMUNITY_ENABLED) return 'accepted';
  // A device-local answer belongs to a guest. An account must prove its own answer before it unlocks.
  if (AuthService.isAuthenticated()) return 'checking';
  return isAgeAttested() ? 'accepted' : 'idle';
};

/**
 * The age attestation, and everything that waits on it.
 *
 * Community Creations carries content other players wrote, so nothing user-written is fetched or shown
 * until the player says they are old enough to see it. Three surfaces ask: the browser, the sign-in path,
 * and boot itself when a session is already signed in — the last one because a held token keeps reading
 * the community server whether or not anybody opened anything.
 *
 * A decline is not remembered. It closes whatever asked and drops the cached browsing, and the next open
 * asks again — the player who turns 18 tomorrow should not have to find a setting.
 */
export function AgeGateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(initialState);
  const [currentSession, setCurrentSession] = useState(sessionKey);
  const [pendingRequest, setPendingRequest] = useState<AttestationRequest | null>(null);
  const pendingRequestRef = useRef(pendingRequest);
  pendingRequestRef.current = pendingRequest;
  const [readAttempt, setReadAttempt] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const authenticationFlowRef = useRef<AgeGateAuthenticationFlow | null>(null);
  const boundAuthenticationRef = useRef<BoundAgeGateAuthentication | null>(null);
  const [boundAuthentication, setBoundAuthentication] = useState<BoundAgeGateAuthentication | null>(null);
  const authenticationCompletionRef = useRef<{ accountKey: string; run: () => void } | null>(null);
  const authenticationAccountRef = useRef<string | null>(null);
  const authenticationRequestRef = useRef(false);
  const activeResolutionRef = useRef<string | null>(null);
  const resolvedSessionRef = useRef<string | null>(null);
  const devRoute = useDevRoute();
  const attested = state === 'accepted';
  const gateOpen = state === 'prompt' || state === 'failed';
  const consumePendingRequest = useCallback(() => {
    const request = pendingRequestRef.current;
    pendingRequestRef.current = null;
    setPendingRequest(null);
    return request;
  }, []);

  const consumeAuthenticationCompletion = useCallback(() => {
    const completion = authenticationCompletionRef.current;
    if (!completion || completion.accountKey !== sessionKey()) return;
    authenticationCompletionRef.current = null;
    authenticationAccountRef.current = null;
    completion.run();
  }, []);

  // Any local or cross-tab identity change starts over. The captured key makes an old response harmless.
  useEffect(() => AuthService.onSessionChanged(() => setCurrentSession(sessionKey())), []);

  // Another tab cannot finish the authentication flow open in this one.
  useEffect(() => AuthService.onSessionAdopted(() => {
    const flow = authenticationFlowRef.current;
    if (boundAuthenticationRef.current || authenticationAccountRef.current) return;
    if (flow) cancelAgeGateAuthentication(flow);
    authenticationFlowRef.current = null;
    authenticationRequestRef.current = false;
    authenticationAccountRef.current = null;
  }), []);

  useEffect(() => {
    if (COMMUNITY_ENABLED && !attested) void purgeCommunityCaches();
  }, [attested]);

  useEffect(() => {
    setSaving(false);
    setReadError(null);
    setWriteError(null);

    if (!COMMUNITY_ENABLED) {
      setState('accepted');
      return;
    }

    if (!AuthService.token) {
      const bound = boundAuthenticationRef.current;
      if (bound) cancelAgeGateAuthentication(bound);
      boundAuthenticationRef.current = null;
      setBoundAuthentication(null);
      authenticationCompletionRef.current = null;
      authenticationAccountRef.current = null;
      activeResolutionRef.current = null;
      resolvedSessionRef.current = null;
      setState(isAgeAttested() ? 'accepted' : pendingRequestRef.current ? 'prompt' : 'idle');
      return;
    }

    if (sessionKey() !== currentSession) return;

    let current = true;
    const bound = boundAuthenticationRef.current;
    if (authenticationRequestRef.current) return;
    if (authenticationFlowRef.current && !bound) return;
    if (bound && bound.accountKey !== currentSession) {
      cancelAgeGateAuthentication(bound);
      boundAuthenticationRef.current = null;
      setBoundAuthentication(null);
      authenticationFlowRef.current = null;
      authenticationCompletionRef.current = null;
      authenticationAccountRef.current = null;
      return;
    }
    if (authenticationCompletionRef.current?.accountKey !== currentSession) {
      authenticationCompletionRef.current = null;
    }

    if (!bound && resolvedSessionRef.current === currentSession) return;
    const resolutionKey = `${currentSession}:${bound?.id ?? 'lookup'}:${readAttempt}`;
    if (activeResolutionRef.current === resolutionKey) return;
    activeResolutionRef.current = resolutionKey;
    setState('checking');

    const resolveAcceptance = bound?.accountKey === currentSession
      ? completeAgeGateAuthentication(bound).then(() => ({
        accepted: true,
        requiredVersion: bound.acceptanceVersion,
        acceptedAt: null,
      }))
      : AgeGateService.read();

    resolveAcceptance
      .then((answer) => {
        if (!current || sessionKey() !== currentSession) return;
        if (answer.requiredVersion !== AGE_GATE_VERSION) {
          setReadError(answer.requiredVersion > AGE_GATE_VERSION
            ? 'Update Formamorph to review the current adult-content warning.'
            : 'The account server is not ready for this content warning. Try again later.');
          setState('failed');
        } else if (answer.accepted) {
          resolvedSessionRef.current = currentSession;
          boundAuthenticationRef.current = null;
          setBoundAuthentication(null);
          authenticationFlowRef.current = null;
          acceptAgeGate();
          setState('accepted');
          consumePendingRequest()?.onAccept?.();
          consumeAuthenticationCompletion();
        } else {
          setState('prompt');
        }
      })
      .catch((error: unknown) => {
        if (!current || sessionKey() !== currentSession) return;
        setReadError((error as Error).message || 'Failed to check your content-warning answer');
        setState('failed');
      });

    return () => { current = false; };
  }, [boundAuthentication, consumeAuthenticationCompletion, consumePendingRequest, currentSession, readAttempt]);

  // DEV: `#dev?modal=ageGate` raises the gate on demand, so its copy is checkable after accepting once.
  useEffect(() => {
    if (import.meta.env.DEV && COMMUNITY_ENABLED && devRoute?.modal === 'ageGate') {
      setPendingRequest({});
      setState('prompt');
    }
  }, [devRoute?.modal]);

  const requireAttestation = useCallback((request: AttestationRequest = {}) => {
    if (!COMMUNITY_ENABLED || state === 'accepted') {
      request.onAccept?.();
      return;
    }
    setPendingRequest(request);
    if (state === 'idle') setState('prompt');
  }, [state]);

  const requireAuthentication = useCallback((request: AttestationRequest) => {
    if (!COMMUNITY_ENABLED) {
      request.onAccept?.();
      return;
    }
    authenticationRequestRef.current = true;
    authenticationAccountRef.current = null;
    if (state === 'accepted') {
      request.onAccept?.();
      return;
    }
    setPendingRequest(request);
    if (state === 'idle') setState('prompt');
  }, [state]);

  const finishAcceptance = useCallback(() => {
    if (authenticationRequestRef.current) {
      authenticationFlowRef.current = beginAgeGateAuthentication();
    }
    acceptAgeGate();
    if (AuthService.token) resolvedSessionRef.current = sessionKey();
    setState('accepted');
    consumePendingRequest()?.onAccept?.();
    consumeAuthenticationCompletion();
  }, [consumeAuthenticationCompletion, consumePendingRequest]);

  const authenticationSucceeded = useCallback((onAcceptanceResolved?: () => void) => {
    const key = sessionKey();
    authenticationAccountRef.current ??= key;
    const flow = authenticationFlowRef.current;
    if (flow && !boundAuthenticationRef.current) {
      const bound = bindAgeGateAuthentication(flow);
      boundAuthenticationRef.current = bound;
    }
    if (!onAcceptanceResolved) return;

    authenticationRequestRef.current = false;
    if (authenticationAccountRef.current !== key) {
      const bound = boundAuthenticationRef.current;
      if (bound) cancelAgeGateAuthentication(bound);
      boundAuthenticationRef.current = null;
      setBoundAuthentication(null);
      authenticationFlowRef.current = null;
      authenticationAccountRef.current = null;
      authenticationCompletionRef.current = null;
      setCurrentSession(key);
      setReadAttempt((attempt) => attempt + 1);
      return;
    }

    authenticationCompletionRef.current = { accountKey: key, run: onAcceptanceResolved };
    setBoundAuthentication(boundAuthenticationRef.current);
    setCurrentSession(key);
    setReadAttempt((attempt) => attempt + 1);
  }, []);

  const authenticationAbandoned = useCallback(() => {
    const flow = authenticationFlowRef.current;
    if (boundAuthenticationRef.current || authenticationAccountRef.current) return;
    if (flow) cancelAgeGateAuthentication(flow);
    authenticationFlowRef.current = null;
    authenticationRequestRef.current = false;
    authenticationAccountRef.current = null;
  }, []);

  const authenticationPrivacyResolved = useCallback(() => {
    if (!authenticationRequestRef.current || !authenticationAccountRef.current) return;
    authenticationSucceeded(() => {});
  }, [authenticationSucceeded]);

  const handleAccept = useCallback(async () => {
    if (state === 'failed') {
      setReadAttempt((attempt) => attempt + 1);
      return;
    }

    if (!AuthService.token) {
      finishAcceptance();
      return;
    }

    const acceptingSession = sessionKey();
    setSaving(true);
    setWriteError(null);
    try {
      await AgeGateService.accept(AGE_GATE_VERSION);
      if (sessionKey() === acceptingSession) finishAcceptance();
    } catch (error) {
      if (sessionKey() === acceptingSession) {
        setWriteError((error as Error).message || 'Failed to record your answer');
      }
    } finally {
      if (sessionKey() === acceptingSession) setSaving(false);
    }
  }, [finishAcceptance, state]);

  const handleDecline = useCallback(() => {
    // Every decline drops the cached browsing, not just the one at boot: the answer has to have an effect.
    void purgeCommunityCaches();
    consumePendingRequest()?.onDecline?.();
    authenticationRequestRef.current = false;
    const flow = authenticationFlowRef.current;
    if (flow) cancelAgeGateAuthentication(flow);
    authenticationFlowRef.current = null;
    authenticationAccountRef.current = null;
    setState('idle');
    if (AuthService.isAuthenticated()) AuthService.logout();
  }, [consumePendingRequest]);

  const value = useMemo(
    () => ({
      attested,
      gateOpen,
      requireAttestation,
      requireAuthentication,
      authenticationSucceeded,
      authenticationPrivacyResolved,
      authenticationAbandoned,
    }),
    [
      attested,
      authenticationAbandoned,
      authenticationPrivacyResolved,
      authenticationSucceeded,
      gateOpen,
      requireAttestation,
      requireAuthentication,
    ],
  );

  return (
    <AgeGateContext.Provider value={value}>
      {children}
      {/* A build with the community features compiled off has nothing to gate, and raises no gate. */}
      {COMMUNITY_ENABLED && (
        <AgeGateDialog
          open={gateOpen}
          onAccept={() => { void handleAccept(); }}
          onDecline={handleDecline}
          busy={saving}
          error={state === 'failed' ? readError : writeError}
          acceptLabel={state === 'failed' || writeError ? 'Retry' : 'Accept'}
        />
      )}
    </AgeGateContext.Provider>
  );
}

/**
 * The age attestation.
 *
 * Throws without a provider above, rather than answering "attested": a surface that quietly loses its
 * gate is exactly the failure this whole effort exists to prevent, so it fails loudly instead.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAgeGate(): AgeGateValue {
  const value = useContext(AgeGateContext);
  if (!value) throw new Error('useAgeGate must be used within an AgeGateProvider');
  return value;
}
