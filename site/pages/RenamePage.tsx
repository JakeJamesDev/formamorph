import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import AuthService from '@/services/AuthService';
import { USERNAME_RULE_HELP, checkUsername } from '@/lib/usernameRule';
import { useMountedRef } from '@/lib/useMountedRef';
import { AccountForm, Field } from '../components/AccountForm';
import { SiteLayout } from '../components/SiteLayout';
import { leaveTo } from '../leaveSite';
import { RENAME_PATH, replaceSite } from '../router';
import { recordRename } from '../renameNotice';

const ACCOUNT_PATH = '/account';

/**
 * The rename a flagged account owes before account features work again.
 *
 * A fresh read of the account decides what the page shows, because a session held since before the rule
 * shipped carries no demand yet. An account that owes nothing goes on to its account page.
 */
export function RenamePage() {
  const [ready, setReady] = useState(false);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useMountedRef();

  useEffect(() => {
    const toLogin = () => replaceSite(`/login?next=${encodeURIComponent(RENAME_PATH)}`);
    if (!AuthService.isAuthenticated()) {
      toLogin();
      return;
    }

    let cancelled = false;
    void AuthService.fetchUserProfile().then(() => {
      if (cancelled) return;
      if (!AuthService.isAuthenticated()) {
        toLogin();
        return;
      }
      const user = AuthService.getCurrentUser();
      const demand = user?.usernameRename?.required ? user.usernameRename : null;
      if (!demand) {
        replaceSite(ACCOUNT_PATH);
        return;
      }
      setCurrentName(user?.username ?? null);
      setName(demand.suggestion ?? '');
      setReady(true);
    });

    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    const verdict = checkUsername(name);
    if (!verdict.ok) {
      setError(verdict.error);
      return;
    }

    setError('');
    setBusy(true);
    try {
      const user = await AuthService.renameUsername(verdict.username);
      recordRename(user.username);
      leaveTo(ACCOUNT_PATH);
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof Error && failure.message ? failure.message : 'Failed to change the username');
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <SiteLayout title="Choose a New Username">
        <p className="text-body text-muted-foreground">Checking your account…</p>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout
      title="Choose a New Username"
      subtitle={currentName
        ? `Formamorph has a new username rule, and ${currentName} doesn't fit it. Choose a new name to keep using your account.`
        : 'Formamorph has a new username rule. Choose a new name to keep using your account.'}
    >
      <AccountForm
        onSubmit={() => { void submit(); }}
        error={error}
        busy={busy}
        submitLabel="Save Username"
        busyLabel="Saving…"
        footer={<>
          Your games and saves aren&apos;t affected. After this, you sign in with the new name.
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full"
            disabled={busy}
            onClick={() => leaveTo(ACCOUNT_PATH)}
          >Later</Button>
        </>}
      >
        <Field
          id="username"
          label="New Username"
          autoComplete="username"
          autoFocus
          hint={USERNAME_RULE_HELP}
          value={name}
          onChange={(value) => { setName(value); setError(''); }}
        />
      </AccountForm>
    </SiteLayout>
  );
}
