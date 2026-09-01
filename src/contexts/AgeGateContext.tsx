import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AgeGateDialog } from '@/components/community/AgeGateDialog';
import { COMMUNITY_ENABLED } from '@/lib/featureFlags';
import { acceptAgeGate, isAgeAttested } from '@/lib/ageGate';
import { purgeCommunityCaches } from '@/lib/communityCaches';
import { useDevRoute } from '@/lib/devRouter';
import AuthService from '@/services/AuthService';

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
}

const AgeGateContext = createContext<AgeGateValue | null>(null);

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
  // Seeded from storage so a returning player never sees a frame of the gate they already answered.
  const [attested, setAttested] = useState(() => !COMMUNITY_ENABLED || isAgeAttested());
  const [pendingRequest, setPendingRequest] = useState<AttestationRequest | null>(null);
  const devRoute = useDevRoute();

  // The boot pass runs once. In StrictMode the effect runs twice, and asking twice would purge caches the
  // first pass has already dropped.
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current || !COMMUNITY_ENABLED || isAgeAttested()) return;
    booted.current = true;

    // Whatever this device cached before the gate existed is community content nobody has attested to.
    void purgeCommunityCaches();

    // A signed-out player is asked by whichever surface they reach for. A signed-in one is asked now:
    // their token is what keeps the community server in the conversation.
    if (!AuthService.isAuthenticated()) return;
    setPendingRequest({ onDecline: () => AuthService.logout() });
  }, []);

  // DEV: `#dev?modal=ageGate` raises the gate on demand, so its copy is checkable after accepting once.
  useEffect(() => {
    if (import.meta.env.DEV && COMMUNITY_ENABLED && devRoute?.modal === 'ageGate') setPendingRequest({});
  }, [devRoute?.modal]);

  const requireAttestation = useCallback((request: AttestationRequest = {}) => {
    if (!COMMUNITY_ENABLED || isAgeAttested()) {
      request.onAccept?.();
      return;
    }
    setPendingRequest(request);
  }, []);

  // Answering runs the asking surface's callback, which moves that surface's state — so it happens after
  // the updater, never inside one. A state updater React may call twice would sign the player out twice.
  const handleAccept = useCallback(() => {
    acceptAgeGate();
    setAttested(true);
    setPendingRequest(null);
    pendingRequest?.onAccept?.();
  }, [pendingRequest]);

  const handleDecline = useCallback(() => {
    // Every decline drops the cached browsing, not just the one at boot: the answer has to have an effect.
    void purgeCommunityCaches();
    setPendingRequest(null);
    pendingRequest?.onDecline?.();
  }, [pendingRequest]);

  const value = useMemo(
    () => ({ attested, gateOpen: pendingRequest !== null, requireAttestation }),
    [attested, pendingRequest, requireAttestation],
  );

  return (
    <AgeGateContext.Provider value={value}>
      {children}
      {/* A build with the community features compiled off has nothing to gate, and raises no gate. */}
      {COMMUNITY_ENABLED && (
        <AgeGateDialog open={pendingRequest !== null} onAccept={handleAccept} onDecline={handleDecline} />
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
