import { useState } from 'react';
import AuthService from '@/services/AuthService';
import { AccountForm, Field } from '../components/AccountForm';
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

  const submit = async () => {
    setError('');

    // Only what AuthService cannot know: it never sees the confirmation, and its own message for an
    // empty name is the length rule, which reads oddly against an untouched box. Every other rule is
    // left to AuthService, which refuses before the network call and throws the sentence to show.
    if (!username) {
      setError('Username is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      await AuthService.register(username, password, email.trim());
      leaveTo(next);
    } catch (failure) {
      setError((failure as Error).message || 'Registration failed');
      setBusy(false);
    }
  };

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
