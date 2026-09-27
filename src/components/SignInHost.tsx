import { useEffect, useRef, useSyncExternalStore } from 'react';
import { SignInDialog } from '@/components/menu/SignInDialog';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { useDevRoute } from '@/lib/devRouter';
import {
  cancelSignIn, getSignInState, requestSignIn, showSignIn, signInSucceeded, subscribeSignIn,
} from '@/lib/signInStore';

/**
 * The sign-in dialog every view raises through the sign-in store. Mounted once, inside the age gate, so
 * every raise runs the gate's authentication check before the dialog opens.
 */
export function SignInHost() {
  const { phase, request } = useSyncExternalStore(subscribeSignIn, getSignInState);
  const { requireAuthentication } = useAgeGate();
  // The check's identity follows the gate's state; a raise runs it once, with the current one.
  const requireRef = useRef(requireAuthentication);
  requireRef.current = requireAuthentication;

  useEffect(() => {
    if (phase === 'checking') requireRef.current({ onAccept: showSignIn, onDecline: cancelSignIn });
    // Keyed on the request, so a second raise while the gate is up runs the check again for it.
  }, [phase, request]);

  // Drops a pending request on unmount.
  useEffect(() => cancelSignIn, []);

  // DEV: `#dev?modal=auth` opens the dialog.
  const devRoute = useDevRoute();
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'auth') requestSignIn();
  }, [devRoute?.modal]);

  return (
    <SignInDialog
      open={phase === 'open'}
      onOpenChange={(next) => { if (!next) cancelSignIn(); }}
      onAuthenticated={signInSucceeded}
    />
  );
}
