import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Key, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hint, Meta } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { useMountedRef } from '@/lib/useMountedRef';
import { useEmailRecheck } from '@/lib/useEmailRecheck';
import { useAccountDeletion } from '@/contexts/AccountDeletionContext';
import AuthService, { emailMarkerOf, type EmailNoticeReason } from '@/services/AuthService';
import { EmailMarkerNotice, QUESTIONS_BOARD_PATH } from '@/components/EmailMarkerNotice';
import { PatreonSection } from '@/components/PatreonSection';
import { openExternal } from '@/lib/openExternal';

type Note = { kind: 'success' | 'error'; text: string } | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-title font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** The address on file and whether it is proven, as the cached account currently says. */
const readEmail = (): { address: string | null; verified: boolean; marker: EmailNoticeReason | null } => {
  const user = AuthService.getCurrentUser();
  return {
    // Cast because `AuthUser` types everything past `username` as `unknown`.
    address: (user?.email as string | null | undefined) ?? null,
    verified: user?.emailVerified === true,
    marker: emailMarkerOf(user),
  };
};

/** The website's Questions board, for a host that cannot open the Feedback window. */
const QUESTIONS_BOARD_URL = `https://formamorph.ai${QUESTIONS_BOARD_PATH}`;

/** The address password reset runs on. Setting one asks for the mail; only a resend is separate. */
function EmailSection({ suspended, onOpenFeedback }: { suspended: boolean; onOpenFeedback?: () => void }) {
  const mounted = useMountedRef();
  const [account, setAccount] = useState(readEmail);
  const [typed, setTyped] = useState(() => readEmail().address ?? '');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<'save' | 'resend' | null>(null);

  const { recheckSoon, drop } = useEmailRecheck((fresh) => {
    setAccount({ address: fresh.email, verified: fresh.emailVerified, marker: fresh.emailMarker });
    // The status line or the notice now says what a "sent" note was waiting on.
    if (fresh.emailMarker || fresh.emailVerified) setNote((held) => (held?.kind === 'success' ? null : held));
  });

  // The cached account can predate the field; one read on arrival settles it.
  useEffect(() => {
    let cancelled = false;

    void AuthService.fetchEmailState().then((fresh) => {
      if (cancelled || !fresh) return;
      setAccount({ address: fresh.email, verified: fresh.emailVerified, marker: fresh.emailMarker });
      // Only fills an untouched box, so a late read cannot overwrite typing.
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
      const { emailVerified, mailSent, undeliverable } = await AuthService.setEmail(address);
      if (!mounted.current) return;
      // A read that started before this answer holds the account as it was.
      drop();
      if (mailSent) recheckSoon();
      setAccount({ ...readEmail(), ...(undeliverable && { verified: false, marker: undeliverable }) });

      // The notice says it all for a marked address.
      if (undeliverable) return;
      if (emailVerified) {
        setNote({ kind: 'success', text: 'That address is already saved and verified.' });
      } else if (mailSent) {
        setNote({ kind: 'success', text: `Verification email sent to ${address}. Open the link in it to finish.` });
      } else {
        setNote({ kind: 'error', text: "Address saved, but the verification email couldn't be sent. Select “Resend Verification Email” in a moment." });
      }
    } catch (failure) {
      if (!mounted.current) return;
      setNote({ kind: 'error', text: failure instanceof Error && failure.message ? failure.message : 'Failed to save the email address' });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const resend = async () => {
    setNote(null);
    setBusy('resend');
    try {
      const { emailVerified, mailSent, undeliverable } = await AuthService.resendVerification();
      if (!mounted.current) return;
      drop();
      if (mailSent) recheckSoon();
      setAccount((held) => ({ ...held, verified: emailVerified, marker: undeliverable ?? held.marker }));

      if (undeliverable) return;
      if (emailVerified) {
        setNote({ kind: 'success', text: 'Your email address is already verified.' });
      } else if (mailSent) {
        setNote({ kind: 'success', text: 'Verification email sent. Open the link in it to finish.' });
      } else {
        setNote({ kind: 'error', text: "The verification email couldn't be sent. Try again in a moment." });
      }
    } catch (failure) {
      if (!mounted.current) return;
      setNote({ kind: 'error', text: failure instanceof Error && failure.message ? failure.message : 'Failed to send the verification email' });
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  return (
    <Section title="Email">
      <Meta as="p">
        {account.address ? (
          <>
            On file: <span className="text-foreground">{account.address}</span>.{' '}
            {account.marker ? 'Not verified.' : account.verified ? 'Verified.' : 'Not verified yet.'}
          </>
        ) : (
          'No email address on file. Add one so you can reset your password.'
        )}
      </Meta>

      {account.address && account.marker && (
        <EmailMarkerNotice
          reason={account.marker}
          feedback={(text) => (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={onOpenFeedback ?? (() => openExternal(QUESTIONS_BOARD_URL))}
            >
              {text}
            </button>
          )}
        />
      )}

      {suspended && (
        <Hint>You can&rsquo;t change your email address while your account is suspended.</Hint>
      )}

      <form onSubmit={(event) => { void save(event); }} noValidate className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="settings-email">Email Address</Label>
          <Hint>You&apos;ll get a link to confirm the new address</Hint>
          <Input
            id="settings-email"
            type="email"
            autoComplete="email"
            disabled={suspended}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        {note && (
          <p
            role={note.kind === 'error' ? 'alert' : 'status'}
            className={cn('text-helper', note.kind === 'error' ? 'text-destructive' : 'text-muted-foreground')}
          >
            {note.text}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy !== null || suspended}>
            {busy === 'save' ? 'Saving…' : 'Save Email'}
          </Button>
          {account.address && !account.verified && !account.marker && (
            <Button
              type="button"
              size="sm"
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

/** The account controls: email, password, and ending the account. */
export function AccountSettingsTab({ suspended, onChangePassword, onOpenFeedback }: {
  suspended: boolean;
  onChangePassword: () => void;
  /** Opens the Feedback window on its Questions tab. */
  onOpenFeedback?: () => void;
}) {
  // Ending the account lives above the menu, because the privacy prompt raises the same flow.
  const { startDeletion } = useAccountDeletion();

  return (
    <div className="space-y-8 py-4">
      <EmailSection suspended={suspended} onOpenFeedback={onOpenFeedback} />

      <PatreonSection openAuthorize={openExternal} refreshOnFocus suspended={suspended} />

      <Section title="Password">
        <Button variant="outline" size="sm" onClick={onChangePassword}>
          <Key className="mr-2 h-4 w-4" /> Change Password
        </Button>
      </Section>

      <Section title="Delete Account">
        <Hint>Erases your account seven days after you ask. Signing in before then cancels it.</Hint>
        {/* Shown to a suspended account too: the flow's first step is where it learns the team does this one. */}
        <Button variant="destructive" size="sm" onClick={startDeletion}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete Account
        </Button>
      </Section>
    </div>
  );
}
