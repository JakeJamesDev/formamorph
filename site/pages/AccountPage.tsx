import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteAccountDialog } from '@/components/menu/DeleteAccountDialog';
import { ProfileAvatarEditor } from '@/components/menu/ProfileAvatarEditor';
import AuthService from '@/services/AuthService';
import { Field } from '../components/AccountForm';
import { NoteLine, type Note } from '../components/NoteLine';
import { SiteLayout } from '../components/SiteLayout';
import { leaveTo } from '../leaveSite';
import { signInTo } from '../nextPath';

/** Where a reader with no session goes, and what brings them back here afterwards. */
const SIGN_IN = signInTo('/account');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-title font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The reader's own face, changed through the same control the game's profile dialog uses. */
function AvatarSection({ username, suspended }: { username: string | null; suspended: boolean }) {
  // Cast because `AuthUser` types everything past `username` as `unknown`; the server sends a string.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (AuthService.getCurrentUser()?.avatarUrl as string | null | undefined) ?? null,
  );
  const [note, setNote] = useState<Note>(null);

  return (
    <Section title="Profile Image">
      {/* The service writes the new URL into the shared user record, so the landing page's header and
          an open `/play/` both pick it up without being told. */}
      <ProfileAvatarEditor
        username={username}
        avatarUrl={avatarUrl}
        onChanged={setAvatarUrl}
        notify={(text, kind) => setNote({ text, kind })}
        disabled={suspended}
      />
      <NoteLine note={note} />
    </Section>
  );
}

/** The address on file and whether it is proven, as the cached account currently says. */
const readEmail = () => {
  const user = AuthService.getCurrentUser();
  return {
    // Cast because `AuthUser` types everything past `username` as `unknown`; the server sends a string
    // or null.
    address: (user?.email as string | null | undefined) ?? null,
    verified: user?.emailVerified === true,
  };
};

/**
 * The address password reset runs on: what is on file, whether it is proven, and the two ways to move
 * it forward.
 *
 * Setting an address is what asks for the mail, so there is no separate send button — only a resend for
 * one that never arrived.
 */
function EmailSection({ suspended }: { suspended: boolean }) {
  const [account, setAccount] = useState(readEmail);
  const [typed, setTyped] = useState(() => readEmail().address ?? '');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<'save' | 'resend' | null>(null);

  // The cached account can predate emails entirely: a session held since before the field existed
  // carries neither the address nor its state, and would render as "none on file" for somebody who has
  // one. One read of the account on arrival settles it.
  useEffect(() => {
    let cancelled = false;

    void AuthService.fetchEmailState().then((fresh) => {
      // Null is a read that could not answer. The cached account is still on screen, and every write
      // below answers for itself, so there is nothing to say.
      if (cancelled || !fresh) return;

      setAccount({ address: fresh.email, verified: fresh.emailVerified });
      // Only fills an untouched box, so a read that lands late cannot overwrite what is being typed.
      setTyped((held) => held || fresh.email || '');
    });

    return () => { cancelled = true; };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setNote(null);

    const address = typed.trim();
    if (!address) {
      setNote({ kind: 'error', text: 'Enter an email address' });
      return;
    }
    if (!AuthService.isValidEmail(address)) {
      setNote({ kind: 'error', text: 'Enter a valid email address' });
      return;
    }

    setBusy('save');
    try {
      const { emailVerified, mailSent } = await AuthService.setEmail(address);
      // Read back from the adopted account rather than from what was typed: the server decides what is
      // stored, and this section is what the rest of the page believes about it.
      setAccount(readEmail());

      if (emailVerified) {
        setNote({ kind: 'success', text: 'That address is already saved and verified.' });
      } else if (mailSent) {
        setNote({ kind: 'success', text: `Verification email sent to ${address}. Open the link in it to finish.` });
      } else {
        // Saved either way, so the sentence says so before it says what failed.
        setNote({ kind: 'error', text: 'Address saved, but the verification email could not be sent. Try Resend in a moment.' });
      }
    } catch (failure) {
      setNote({ kind: 'error', text: (failure as Error).message || 'Failed to save the email address' });
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    setNote(null);
    setBusy('resend');
    try {
      const { emailVerified, mailSent } = await AuthService.resendVerification();
      setAccount((held) => ({ ...held, verified: emailVerified }));

      if (emailVerified) {
        setNote({ kind: 'success', text: 'Your email address is already verified.' });
      } else if (mailSent) {
        setNote({ kind: 'success', text: 'Verification email sent. Open the link in it to finish.' });
      } else {
        setNote({ kind: 'error', text: 'The verification email could not be sent. Try again in a moment.' });
      }
    } catch (failure) {
      setNote({ kind: 'error', text: (failure as Error).message || 'Failed to send the verification email' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Email">
      {/* Not a live region: what changes here is announced by the note under the control, and a second
          region saying the same thing twice is worse than none. */}
      <p className="text-helper text-muted-foreground">
        {account.address ? (
          <>
            On file: <span className="text-foreground">{account.address}</span>.{' '}
            {account.verified ? 'Verified.' : 'Not verified yet.'}
          </>
        ) : (
          'No email address on file. Add one so you can reset your password.'
        )}
      </p>

      {suspended && (
        <p className="text-helper text-muted-foreground">
          Your email address can&rsquo;t be changed while your account is suspended.
        </p>
      )}

      <form onSubmit={(event) => { void save(event); }} noValidate className="space-y-4">
        <Field
          id="email"
          label="Email Address"
          type="email"
          autoComplete="email"
          disabled={suspended}
          hint="Changing your address means confirming the new one."
          value={typed}
          onChange={setTyped}
        />
        <NoteLine note={note} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy !== null || suspended}>
            {busy === 'save' ? 'Saving…' : 'Save Email'}
          </Button>
          {/* Only where it can do something: there is an address, and it is still unproven. */}
          {account.address && !account.verified && (
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null || suspended}
              onClick={() => { void resend(); }}
            >
              {busy === 'resend' ? 'Sending…' : 'Resend Verification Email'}
            </Button>
          )}
        </div>
      </form>
    </Section>
  );
}

function PasswordSection({ suspended }: { suspended: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNote(null);

    if (!current || !next) {
      setNote({ kind: 'error', text: 'Both current and new passwords are required' });
      return;
    }

    setBusy(true);
    try {
      await AuthService.changePassword(current, next);
      // Emptied on success only: a refusal leaves what they typed so they can fix one box of it.
      setCurrent('');
      setNext('');
      setNote({ kind: 'success', text: 'Password changed successfully' });
    } catch (failure) {
      setNote({ kind: 'error', text: (failure as Error).message || 'Failed to change password' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Change Password">
      {/* Said before the boxes rather than after a submit: the server refuses this write, and finding
          that out by filling the form in and being turned away is the worse way to learn it. */}
      {suspended && (
        <p className="text-helper text-muted-foreground">
          Your password can&rsquo;t be changed while your account is suspended.
        </p>
      )}

      <form onSubmit={(event) => { void submit(event); }} noValidate className="space-y-4">
        <Field
          id="currentPassword"
          label="Current Password"
          type="password"
          autoComplete="current-password"
          disabled={suspended}
          value={current}
          onChange={setCurrent}
        />
        <Field
          id="newPassword"
          label="New Password"
          type="password"
          autoComplete="new-password"
          disabled={suspended}
          value={next}
          onChange={setNext}
        />
        <NoteLine note={note} />
        <Button type="submit" disabled={busy || suspended}>
          {busy ? 'Updating…' : 'Update Password'}
        </Button>
      </form>
    </Section>
  );
}

/**
 * The way out.
 *
 * The dialog is the game's, so the seven days, the choice about published work and the password step
 * are one implementation rather than two that have to be kept saying the same thing.
 */
function DeleteSection({ suspended, open, onOpenChange }: {
  suspended: boolean;
  open: boolean;
  /** Held above, because a deletion in flight is what stops the page leaving on its own session ending. */
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => {
    onOpenChange(false);
    // The request ends the session as it goes out, so by the time the reader closes the confirmation
    // there is nothing on this page for them. Checked rather than assumed: they may have backed out.
    if (!AuthService.isAuthenticated()) leaveTo('/');
  };

  return (
    <Section title="Delete Account">
      <p className="text-helper text-muted-foreground">
        Your account is erased seven days after you ask. Signing in during those seven days calls it off.
      </p>
      {/* Offered to a suspended account too: the flow's first step is where it learns the team does
          this one, rather than a control that is missing without explanation. */}
      <Button variant="destructive" onClick={() => onOpenChange(true)}>Delete Account</Button>
      <DeleteAccountDialog open={open} onClose={close} suspended={suspended} />
    </Section>
  );
}

/**
 * `formamorph.ai/account` — the picture, the password and the door out, for a player who would rather
 * not open the game to reach them.
 *
 * Everything here writes through the same service the game writes through, into the same keys on the
 * same origin, so a change made on either side is the other side's next read.
 */
export function AccountPage() {
  // Read once, on arrival, and not again. A session that ends while the page is open is a sign-out or
  // a deletion, and neither belongs at the sign-in page — signing in is what calls a deletion off.
  const [arrivedSignedIn] = useState(() => AuthService.isAuthenticated());
  const user = AuthService.getCurrentUser();
  // A suspended account can sign in and read, but the server refuses every write it could make here.
  const suspended = user?.status === 'suspended';
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!arrivedSignedIn) leaveTo(SIGN_IN);
  }, [arrivedSignedIn]);

  // A sign-out in another tab arrives through the shared keys, and this page is then somebody else's.
  // The reader's own deletion ends the session too, but that flow is still on screen saying when the
  // account goes, so it sends itself away when they close it rather than being pulled out from under.
  useEffect(() => {
    if (deleting) return;

    return AuthService.onSessionEnded(() => leaveTo('/'));
  }, [deleting]);

  if (!arrivedSignedIn) {
    return (
      <SiteLayout title="Your Account">
        <p className="text-body text-muted-foreground">Taking you to sign in…</p>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout title="Your Account" subtitle="The same account you play with.">
      {suspended && (
        <div className="mb-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <div className="text-label">
            <p className="font-bold text-destructive">Account Suspended</p>
            <p className="text-muted-foreground">Check your messages in the game for details.</p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        <AvatarSection username={user?.username ?? null} suspended={suspended} />
        <EmailSection suspended={suspended} />
        <PasswordSection suspended={suspended} />
        <DeleteSection suspended={suspended} open={deleting} onOpenChange={setDeleting} />
      </div>
    </SiteLayout>
  );
}
