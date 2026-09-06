import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import AuthService from '@/services/AuthService';
import PolicyService from '@/services/PolicyService';
import type { PublicPrivacyPolicy } from '@/types';
import { AccountForm, Field } from '../components/AccountForm';
import { SiteMarkdown } from '../components/SiteMarkdown';
import { SiteLayout } from '../components/SiteLayout';
import { leaveTo } from '../leaveSite';
import { useNextPath } from '../useNextPath';

/** Create an account on the site. Same rules as the game's own register form, and the same session. */
export function RegisterPage() {
  const { next, carry } = useNextPath();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [startedSignedIn] = useState(() => AuthService.isAuthenticated());
  const [accountCreated, setAccountCreated] = useState(startedSignedIn);
  const [checking, setChecking] = useState(startedSignedIn);
  const [policy, setPolicy] = useState<PublicPrivacyPolicy | null>(null);
  const checkedExisting = useRef(false);

  const checkAccountPolicy = useCallback(async () => {
    setChecking(true);
    setError('');
    try {
      const state = await PolicyService.fetchPolicies();
      const pending = state.privacyPolicy;
      if (pending && !pending.accepted) {
        setPolicy({ title: pending.title, body: pending.body });
      } else {
        leaveTo(next);
      }
    } catch (failure) {
      setError((failure as Error).message || 'Could not load the privacy policy');
    } finally {
      setChecking(false);
    }
  }, [next]);

  useEffect(() => {
    if (!startedSignedIn || checkedExisting.current) return;
    checkedExisting.current = true;
    void checkAccountPolicy();
  }, [checkAccountPolicy, startedSignedIn]);

  const submit = async () => {
    setError('');

    // Validate before the policy step; AuthService repeats the server rules at the network boundary.
    if (!username) {
      setError('Username is required');
      return;
    }
    if (username.length < 3 || username.length > 20) {
      setError('Username must be between 3 and 20 characters');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (email.trim() && !AuthService.isValidEmail(email.trim())) {
      setError('Invalid email format');
      return;
    }

    setBusy(true);
    try {
      let currentPolicy: PublicPrivacyPolicy | null = null;
      let policyReadFailed = false;
      try {
        currentPolicy = await PolicyService.fetchPublicPrivacyPolicy();
      } catch (failure) {
        console.error('Failed to read the privacy policy before signup:', failure);
        policyReadFailed = true;
      }

      if (currentPolicy) {
        setPolicy(currentPolicy);
        return;
      }

      await AuthService.register(username, password, email.trim());
      setAccountCreated(true);
      if (policyReadFailed) await checkAccountPolicy();
      else leaveTo(next);
    } catch (failure) {
      setError((failure as Error).message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const acceptPolicy = async () => {
    setBusy(true);
    setError('');
    const creating = !accountCreated;

    if (creating) {
      try {
        await AuthService.register(username, password, email.trim());
        setAccountCreated(true);
      } catch (failure) {
        setPolicy(null);
        setError((failure as Error).message || 'Registration failed');
        setBusy(false);
        return;
      }
    }

    try {
      await PolicyService.acceptPrivacyPolicy();
      leaveTo(next);
    } catch (failure) {
      setError(creating
        ? 'Your account was created, but recording your acceptance failed. Try again.'
        : (failure as Error).message || 'Failed to record your acceptance');
    } finally {
      setBusy(false);
    }
  };

  const leavePolicy = () => {
    setPolicy(null);
    setError('');
    if (accountCreated) {
      AuthService.logout();
      setAccountCreated(false);
    }
  };

  if (policy) {
    return (
      <SiteLayout
        title={policy.title}
        subtitle={accountCreated
          ? 'Accept the current policy to finish setting up your account.'
          : 'Read and accept the policy to create your account.'}
        width="page"
      >
        <SiteMarkdown text={policy.body} />
        {error && <p role="alert" className="mt-4 text-helper text-destructive">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={leavePolicy} disabled={busy}>
            {accountCreated ? 'Sign Out' : 'Decline'}
          </Button>
          <Button onClick={() => { void acceptPolicy(); }} disabled={busy}>
            {busy ? 'Recording Acceptance…' : accountCreated ? 'Accept' : 'Accept and Create Account'}
          </Button>
        </div>
      </SiteLayout>
    );
  }

  if (accountCreated) {
    return (
      <SiteLayout title="Finish Account Setup">
        <p className="text-body text-muted-foreground">
          {checking ? 'Checking your account…' : 'Your account is signed in, but its privacy answer could not be checked.'}
        </p>
        {error && <p role="alert" className="mt-4 text-helper text-destructive">{error}</p>}
        {!checking && (
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={leavePolicy}>Sign Out</Button>
            <Button onClick={() => { void checkAccountPolicy(); }}>Try Again</Button>
          </div>
        )}
      </SiteLayout>
    );
  }

  return (
    <SiteLayout title="Create Account" subtitle="One account for the site and for the game.">
      <AccountForm
        onSubmit={() => { void submit(); }}
        error={error}
        busy={busy}
        submitLabel="Create Account"
        busyLabel="Creating Account…"
        footer={<>
          Already have an account?{' '}
          <a className="text-primary hover:underline" href={`/login${carry}`}>Sign in</a>
        </>}
      >
        <Field
          id="username"
          label="Username"
          autoComplete="username"
          autoFocus
          hint="3 to 20 characters."
          value={username}
          onChange={setUsername}
        />
        {/* Optional, and the account works without one. It is what password reset needs, so what the
            hint states is what it buys rather than that it may be left blank. */}
        <Field
          id="email"
          label="Email (Optional)"
          type="email"
          autoComplete="email"
          hint="Lets you reset your password. We send one message to confirm it."
          value={email}
          onChange={setEmail}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 6 characters."
          value={password}
          onChange={setPassword}
        />
        <Field
          id="confirm-password"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />
      </AccountForm>
    </SiteLayout>
  );
}
