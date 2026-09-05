import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import AuthService from '@/services/AuthService';
import { NoteLine, type Note } from '../components/NoteLine';
import { SiteLayout } from '../components/SiteLayout';
import { useSiteLocation } from '../router';
import { signInTo } from '../nextPath';

/** Where a reader with no session goes to ask for a fresh mail. */
const SIGN_IN = signInTo('/account');

/** What the page knows so far. The two refusals are separate because only one of them is worth
 *  offering a fresh mail for: a link the server refused is spent, and a request that never reached an
 *  answer may still work on the next try. */
type Stage =
  | { name: 'checking' }
  | { name: 'verified'; email: string | null }
  | { name: 'spent'; message: string }
  | { name: 'failed'; message: string };

/**
 * The way forward from a spent link: ask for another mail.
 *
 * Asking needs a session, and the link is often opened on a device that holds none — a mail read on a
 * phone, an account signed in on a desktop. So the signed-out reader is sent to sign in first, landing
 * on the account page where the same button waits.
 */
function ResendPath() {
  // Read once. A sign-in happening in another tab while this page sits open does not change what this
  // reader was told to do, and swapping the control under them would.
  const [signedIn] = useState(() => AuthService.isAuthenticated());
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <p className="text-helper text-muted-foreground">
        <a className="text-primary hover:underline" href={SIGN_IN}>Sign in</a>
        {' '}to send yourself a new one.
      </p>
    );
  }

  const resend = async () => {
    setNote(null);
    setBusy(true);
    try {
      const { emailVerified, mailSent } = await AuthService.resendVerification();

      if (emailVerified) {
        setNote({ kind: 'success', text: 'Your email address is already verified. Nothing more to do.' });
      } else if (mailSent) {
        setNote({ kind: 'success', text: 'Verification email sent. Open the link in it to finish.' });
      } else {
        setNote({ kind: 'error', text: 'The verification email could not be sent. Try again in a moment.' });
      }
    } catch (failure) {
      setNote({ kind: 'error', text: (failure as Error).message || 'Failed to send the verification email' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button disabled={busy} onClick={() => { void resend(); }}>
        {busy ? 'Sending…' : 'Send a New Link'}
      </Button>
      <NoteLine note={note} />
    </div>
  );
}

/**
 * `formamorph.ai/verify-email` — where the link in the verification mail lands.
 *
 * The token in the address bar is the whole credential, so the page works without a session: whoever
 * opened the mail proved the address by opening it.
 */
export function VerifyEmailPage() {
  const { search } = useSiteLocation();
  const token = new URLSearchParams(search).get('token');

  const [stage, setStage] = useState<Stage>(() => token
    ? { name: 'checking' }
    : { name: 'spent', message: 'That link is missing its verification code.' });

  // The token works once, so a second consume turns a good link into a dead one — and StrictMode runs
  // every effect twice, which is exactly that second consume. Held in a ref rather than in state
  // because it must be true before the next render, not after one.
  const asked = useRef(false);

  useEffect(() => {
    if (!token || asked.current) return;
    asked.current = true;

    // Not guarded against unmount: the guard would have to be per-effect-run, and StrictMode's cleanup
    // of the first run would then throw away the one answer this page ever gets.
    void AuthService.verifyEmail(token).then((result) => {
      if (result.verified) {
        setStage({ name: 'verified', email: result.email });
      } else if (result.spent) {
        setStage({ name: 'spent', message: result.message });
      } else {
        setStage({ name: 'failed', message: result.message });
      }
    });
  }, [token]);

  if (stage.name === 'checking') {
    return (
      <SiteLayout title="Verify Email">
        <p role="status" className="text-body text-muted-foreground">Checking your link…</p>
      </SiteLayout>
    );
  }

  if (stage.name === 'verified') {
    return (
      <SiteLayout title="Email Verified" subtitle="Password reset is ready to use.">
        <p role="status" className="text-body text-muted-foreground">
          {stage.email
            ? <><span className="text-foreground">{stage.email}</span> is confirmed.</>
            : 'Your email address is confirmed.'}
        </p>
        <p className="mt-4 text-helper text-muted-foreground">
          <a className="text-primary hover:underline" href="/account">Your account</a>
          {' · '}
          <a className="text-primary hover:underline" href="/play/">Play</a>
        </p>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout title={stage.name === 'spent' ? 'Link Expired' : 'Something Went Wrong'}>
      <div className="space-y-4">
        <p role="alert" className="text-body text-muted-foreground">{stage.message}</p>
        {/* A fresh mail fixes a spent link. It does not fix a server that never answered, so that case
            is told to try the same link again instead of being sent to spend a mail on nothing. */}
        {stage.name === 'spent' ? (
          <ResendPath />
        ) : (
          <p className="text-helper text-muted-foreground">
            Open the link from your email again in a moment.
          </p>
        )}
      </div>
    </SiteLayout>
  );
}
