import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import AuthService from '@/services/AuthService';
import { USERNAME_RULE_HELP, USERNAME_RULE_INTRO } from '@/lib/usernameRule';
import { useRenameSubmit } from '@/lib/useRenameSubmit';
import { AccountForm, Field } from '../components/AccountForm';
import { SiteLayout } from '../components/SiteLayout';
import { leaveTo } from '../leaveSite';
import { ACCOUNT_PATH, RENAME_PATH, replaceSite } from '../router';
import { recordRename } from '../renameNotice';

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
  const { error, clearError, busy, submit } = useRenameSubmit((user) => {
    recordRename(user.username);
    leaveTo(ACCOUNT_PATH);
  });

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
        ? `${USERNAME_RULE_INTRO}, and ${currentName} doesn't fit it. Choose a new name to keep using your account.`
        : `${USERNAME_RULE_INTRO}. Choose a new name to keep using your account.`}
    >
      <AccountForm
        onSubmit={() => { void submit(name); }}
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
          onChange={(value) => { setName(value); clearError(); }}
        />
      </AccountForm>
    </SiteLayout>
  );
}
