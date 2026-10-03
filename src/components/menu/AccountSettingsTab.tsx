import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Key, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useMountedRef } from '@/lib/useMountedRef';
import { useAccountDeletion } from '@/contexts/AccountDeletionContext';
import AuthService from '@/services/AuthService';
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
const readEmail = () => {
  const user = AuthService.getCurrentUser();
  return {
    // Cast because `AuthUser` types everything past `username` as `unknown`.
    address: (user?.email as string | null | undefined) ?? null,
    verified: user?.emailVerified === true,
  };
};

/** The address password reset runs on. Setting one asks for the mail; only a resend is separate. */
function EmailSection({ suspended }: { suspended: boolean }) {
  const mounted = useMountedRef();
  const [account, setAccount] = useState(readEmail);
  const [typed, setTyped] = useState(() => readEmail().address ?? '');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<'save' | 'resend' | null>(null);

  // The cached account can predate the field; one read on arrival settles it.
  useEffect(() => {
    let cancelled = false;

    void AuthService.fetchEmailState().then((fresh) => {
      if (cancelled || !fresh) return;
      setAccount({ address: fresh.email, verified: fresh.emailVerified });
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
      const { emailVerified, mailSent } = await AuthService.setEmail(address);
      if (!mounted.current) return;
      setAccount(readEmail());

      if (emailVerified) {
        setNote({ kind: 'success', text: 'That address is already saved and verified.' });
      } else if (mailSent) {
        setNote({ kind: 'success', text: `Verification email sent to ${address}. Open the link in it to finish.` });
      } else {
        setNote({ kind: 'error', text: 'Address saved, but the verification email could not be sent. Try Resend Verification Email in a moment.' });
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
      const { emailVerified, mailSent } = await AuthService.resendVerification();
      if (!mounted.current) return;
      setAccount((held) => ({ ...held, verified: emailVerified }));

      if (emailVerified) {
        setNote({ kind: 'success', text: 'Your email address is already verified.' });
      } else if (mailSent) {
        setNote({ kind: 'success', text: 'Verification email sent. Open the link in it to finish.' });
      } else {
        setNote({ kind: 'error', text: 'The verification email could not be sent. Try again in a moment.' });
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

      <form onSubmit={(event) => { void save(event); }} noValidate className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="settings-email">Email Address</Label>
          <Input
            id="settings-email"
            type="email"
            autoComplete="email"
            disabled={suspended}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <p className="text-helper text-muted-foreground">Confirm the new address by email after you change it.</p>
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
          {account.address && !account.verified && (
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
export function AccountSettingsTab({ suspended, onChangePassword }: {
  suspended: boolean;
  onChangePassword: () => void;
}) {
  // Ending the account lives above the menu, because the privacy prompt raises the same flow.
  const { startDeletion } = useAccountDeletion();

  return (
    <div className="space-y-8 py-4">
      <EmailSection suspended={suspended} />

      <PatreonSection openAuthorize={openExternal} refreshOnFocus suspended={suspended} />

      <Section title="Password">
        <Button variant="outline" size="sm" onClick={onChangePassword}>
          <Key className="mr-2 h-4 w-4" /> Change Password
        </Button>
      </Section>

      <Section title="Delete Account">
        <p className="text-helper text-muted-foreground">
          We erase your account seven days after you ask. Sign in during those days to cancel.
        </p>
        {/* Shown to a suspended account too: the flow's first step is where it learns the team does this one. */}
        <Button variant="destructive" size="sm" onClick={startDeletion}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete Account
        </Button>
      </Section>
    </div>
  );
}
