import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AgeGateDialog } from '@/components/community/AgeGateDialog';
import { Button } from '@/components/ui/button';
import { AGE_GATE_VERSION, acceptAgeGate, isAgeAttested } from '@/lib/ageGate';
import {
  beginAgeGateAuthentication,
  cancelAgeGateAuthentication,
} from '@/lib/ageGateAuthentication';
import type { AgeGateAuthenticationFlow } from '@/types';
import AgeGateService from '@/services/AgeGateService';
import AuthService from '@/services/AuthService';
import {
  SiteAgeGateAuthenticationContext,
  useAgeGateAuthenticationHandoff,
} from '../ageGateAuthenticationContext';
import { leaveTo } from '../leaveSite';
import { SiteLayout } from './SiteLayout';

type GateState = 'checking' | 'prompt' | 'accepted' | 'failed';

const initialState = (): GateState => {
  if (AuthService.isAuthenticated()) return 'checking';
  return isAgeAttested() ? 'accepted' : 'prompt';
};

/**
 * The attestation that stands in front of community content here, exactly as it does in the game.
 *
 * Guests share the app's local record. Signed-in readers restore and write the account record first,
 * then mirror a successful answer locally for the game on this device.
 *
 * The children are not rendered at all until the answer is in, rather than hidden behind the dialog: a
 * mounted profile fetches, and a fetch is the page having already been visited.
 */
export function SiteAgeGate({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState(AuthService.token);
  const [state, setState] = useState<GateState>(initialState);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [readAttempt, setReadAttempt] = useState(0);
  const [authenticationFlow, setAuthenticationFlow] = useState<AgeGateAuthenticationFlow | null>(null);
  const continueAuthentication = useAgeGateAuthenticationHandoff(authenticationFlow);
  const authentication = useMemo(
    () => ({ flow: authenticationFlow, continueAuthentication }),
    [authenticationFlow, continueAuthentication],
  );

  useEffect(() => AuthService.onSessionChanged(() => {
    setSessionToken(AuthService.token);
    setAuthenticationFlow((flow) => {
      if (flow) cancelAgeGateAuthentication(flow);
      return null;
    });
  }), []);

  useEffect(() => {
    setSaving(false);
    setWriteError(null);

    if (!sessionToken) {
      setState(isAgeAttested() ? 'accepted' : 'prompt');
      return;
    }

    let current = true;
    setState('checking');
    setReadError(null);
    AgeGateService.read()
      .then((answer) => {
        if (!current || AuthService.token !== sessionToken) return;
        if (answer.requiredVersion !== AGE_GATE_VERSION) {
          setReadError(answer.requiredVersion > AGE_GATE_VERSION
            ? 'Update Formamorph to review the current adult-content warning.'
            : 'The account server is not ready for this content warning. Try again later.');
          setState('failed');
          return;
        }
        if (answer.accepted) {
          acceptAgeGate();
          setState('accepted');
        } else {
          setState('prompt');
        }
      })
      .catch((error: unknown) => {
        if (current && AuthService.token === sessionToken) {
          setReadError((error as Error).message || 'Failed to check your content-warning answer');
          setState('failed');
        }
      });

    return () => { current = false; };
  }, [readAttempt, sessionToken]);

  if (state === 'accepted') {
    return (
      <SiteAgeGateAuthenticationContext.Provider value={authentication}>
        {children}
      </SiteAgeGateAuthenticationContext.Provider>
    );
  }
  if (state === 'checking') return null;
  if (state === 'failed') {
    return (
      <SiteLayout title="Content warning unavailable" subtitle="We need to check your account before showing this profile.">
        <div className="space-y-4">
          <p role="alert" className="text-label text-destructive">{readError}</p>
          <Button onClick={() => setReadAttempt((attempt) => attempt + 1)}>Retry</Button>
        </div>
      </SiteLayout>
    );
  }

  const accept = async () => {
    if (!sessionToken) {
      acceptAgeGate();
      setAuthenticationFlow(beginAgeGateAuthentication());
      setState('accepted');
      return;
    }

    const token = sessionToken;
    setSaving(true);
    setWriteError(null);
    try {
      await AgeGateService.accept(AGE_GATE_VERSION);
      if (AuthService.token !== token) return;
      acceptAgeGate();
      setState('accepted');
    } catch (error) {
      if (AuthService.token === token) setWriteError((error as Error).message || 'Failed to record your answer');
    } finally {
      if (AuthService.token === token) setSaving(false);
    }
  };

  return (
    <AgeGateDialog
      open
      onAccept={() => { void accept(); }}
      // Declining is a refusal of the whole surface, not of this one profile, so it leaves for the
      // landing page rather than returning the reader to a link they have already said no to.
      onDecline={() => leaveTo('/')}
      busy={saving}
      error={writeError}
      acceptLabel={writeError ? 'Retry' : 'Accept'}
    />
  );
}
