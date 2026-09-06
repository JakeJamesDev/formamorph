import { useState } from 'react';
import AuthService from '@/services/AuthService';
import { AccountForm, Field } from '../components/AccountForm';
import { SiteLayout } from '../components/SiteLayout';
import { useSiteLocation } from '../router';

const CONFIRMATION = 'If that account has a verified email, a password reset link is on its way.';

type Outcome =
  | { name: 'form' }
  | { name: 'requestAccepted' }
  | { name: 'reset' }
  | { name: 'spentLink'; message: string };

/** Request a password-reset mail, without revealing whether the named account exists. */
export function ResetPasswordPage() {
  const { search } = useSiteLocation();
  const token = new URLSearchParams(search).get('token');
  const [account, setAccount] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ name: 'form' });

  const submit = async () => {
    setError('');
    if (!account.trim()) {
      setError('Email or username is required');
      return;
    }

    setBusy(true);
    try {
      await AuthService.requestPasswordReset(account.trim());
      setOutcome({ name: 'requestAccepted' });
    } catch (failure) {
      setError((failure as Error).message || 'Failed to request a password reset');
      setBusy(false);
    }
  };

  const complete = async () => {
    setError('');
    if (!newPassword) {
      setError('A new password is required');
      return;
    }

    setBusy(true);
    try {
      const result = await AuthService.resetPassword(token as string, newPassword);
      if (result.reset) setOutcome({ name: 'reset' });
      else setOutcome({ name: 'spentLink', message: result.message });
    } catch (failure) {
      setError((failure as Error).message || 'Failed to reset the password');
      setBusy(false);
    }
  };

  if (token) {
    if (outcome.name === 'spentLink') {
      return (
        <SiteLayout title="Link Expired">
          <p role="alert" className="text-body text-muted-foreground">{outcome.message}</p>
          <p className="mt-4 text-helper text-muted-foreground">
            <a className="text-primary hover:underline" href="/reset-password">Request a New Link</a>
          </p>
        </SiteLayout>
      );
    }

    return (
      <SiteLayout title="Choose a New Password">
        {outcome.name === 'reset' ? (
          <>
            <p role="status" className="text-body text-muted-foreground">Your password has been reset.</p>
            <p className="mt-4 text-helper text-muted-foreground">
              <a className="text-primary hover:underline" href="/login">Sign In</a>
              {' '}with your new password.
            </p>
          </>
        ) : (
          <AccountForm
            onSubmit={() => { void complete(); }}
            error={error}
            busy={busy}
            submitLabel="Reset Password"
            busyLabel="Resetting…"
            footer={<a className="text-primary hover:underline" href="/login">Back to sign in</a>}
          >
            <Field
              id="newPassword"
              label="New Password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={newPassword}
              onChange={setNewPassword}
            />
          </AccountForm>
        )}
      </SiteLayout>
    );
  }

  return (
    <SiteLayout title="Reset Password" subtitle="Enter the email or username on your account.">
      {outcome.name === 'requestAccepted' ? (
        <>
          <p role="status" className="text-body text-muted-foreground">{CONFIRMATION}</p>
          <p className="mt-4 text-helper text-muted-foreground">
            <a className="text-primary hover:underline" href="/login">Back to sign in</a>
          </p>
        </>
      ) : (
        <AccountForm
          onSubmit={() => { void submit(); }}
          error={error}
          busy={busy}
          submitLabel="Send Reset Link"
          busyLabel="Sending…"
          footer={<a className="text-primary hover:underline" href="/login">Back to sign in</a>}
        >
          <Field
            id="account"
            label="Email or Username"
            autoComplete="username"
            autoFocus
            value={account}
            onChange={setAccount}
          />
        </AccountForm>
      )}
    </SiteLayout>
  );
}
