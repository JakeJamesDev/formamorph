import { useState } from 'react';
import AuthService from '@/services/AuthService';
import { AccountForm, Field } from '../components/AccountForm';
import { SiteLayout } from '../components/SiteLayout';
import { leaveTo } from '../leaveSite';
import { useNextPath } from '../useNextPath';
import { useAgeGateAuthenticationHandoff } from '../ageGateAuthenticationContext';
import { recordDeletionCancellation } from '@/lib/deletionCancellation';
import {
  AgeGateAuthenticationChangedError,
  bindAgeGateAuthentication,
  completeAgeGateAuthentication,
  readAgeGateAuthentication,
  withAgeGateAuthentication,
} from '@/lib/ageGateAuthentication';
import type { BoundAgeGateAuthentication } from '@/types';

interface PendingCompletion {
  flow: BoundAgeGateAuthentication;
  deletionCancelled: boolean;
}

/** Sign in on the site. The session it stores is the one `/play/` reads, because both are one origin. */
export function LoginPage() {
  const { next, carry } = useNextPath();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authenticationFlow] = useState(readAgeGateAuthentication);
  const continueAuthentication = useAgeGateAuthenticationHandoff(authenticationFlow);
  const [pendingCompletion, setPendingCompletion] = useState<PendingCompletion | null>(null);

  const finish = (deletionCancelled: boolean) => {
    if (deletionCancelled) recordDeletionCancellation();
    leaveTo(next);
  };

  const persistAnswer = async (pending: PendingCompletion) => {
    setBusy(true);
    setError('');
    try {
      await completeAgeGateAuthentication(pending.flow);
      setPendingCompletion(null);
      finish(pending.deletionCancelled);
    } catch (failure) {
      if (failure instanceof AgeGateAuthenticationChangedError) setPendingCompletion(null);
      setError((failure as Error).message || 'Failed to record your content-warning answer');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError('');

    if (!username || !password) {
      setError('Username and password are required');
      return;
    }

    setBusy(true);
    try {
      const result = await AuthService.login(username, password);
      if (!authenticationFlow) {
        finish(result.deletionCancelled);
        return;
      }

      const pending = {
        flow: bindAgeGateAuthentication(authenticationFlow),
        deletionCancelled: result.deletionCancelled,
      };
      setPendingCompletion(pending);
      await persistAnswer(pending);
    } catch (failure) {
      setError((failure as Error).message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout title="Sign In" subtitle="Your Formamorph account works here and in the game.">
      <AccountForm
        onSubmit={() => {
          if (pendingCompletion) void persistAnswer(pendingCompletion);
          else void submit();
        }}
        error={error}
        busy={busy}
        submitLabel={pendingCompletion ? 'Retry' : 'Sign In'}
        busyLabel={pendingCompletion ? 'Saving…' : 'Signing In…'}
        footer={<>
          No account yet?{' '}
          <a
            className="text-primary hover:underline"
            href={withAgeGateAuthentication(`/register${carry}`, authenticationFlow)}
            onClick={continueAuthentication}
          >Create one</a>
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
        <p className="text-right text-helper">
          <a className="text-primary hover:underline" href="/reset-password">Forgot password?</a>
        </p>
      </AccountForm>
    </SiteLayout>
  );
}
