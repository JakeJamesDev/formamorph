import { useState } from 'react';
import AuthService from '@/services/AuthService';
import { AccountForm, Field } from '../components/AccountForm';
import { SiteLayout } from '../components/SiteLayout';
import { leaveTo } from '../leaveSite';
import { useNextPath } from '../useNextPath';

/** Sign in on the site. The session it stores is the one `/play/` reads, because both are one origin. */
export function LoginPage() {
  const { next, carry } = useNextPath();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');

    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    setBusy(true);
    try {
      await AuthService.login(username, password);
      leaveTo(next);
    } catch (failure) {
      setError((failure as Error).message || 'Login failed');
      setBusy(false);
    }
  };

  return (
    <SiteLayout title="Sign In" subtitle="Your Formamorph account works here and in the game.">
      <AccountForm
        onSubmit={() => { void submit(); }}
        error={error}
        busy={busy}
        submitLabel="Sign In"
        busyLabel="Signing In…"
        footer={<>
          No account yet?{' '}
          <a className="text-primary hover:underline" href={`/register${carry}`}>Create one</a>
        </>}
      >
        <Field
          id="username"
          label="Username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={setUsername}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
        />
      </AccountForm>
    </SiteLayout>
  );
}
