import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAgeGate } from '@/contexts/AgeGateContext';
import { usePrivacyPolicy } from '@/contexts/PrivacyPolicyContext';
import { useDevRoute } from '@/lib/devRouter';
import { useMountedRef } from '@/lib/useMountedRef';
import { watchRefusals } from '@/lib/refusalWatch';
import { getSignInState, subscribeSignIn } from '@/lib/signInStore';
import { USERNAME_RULE_HELP, USERNAME_RULE_INTRO } from '@/lib/usernameRule';
import { useRenameSubmit } from '@/lib/useRenameSubmit';
import AuthService, { USERNAME_RENAME_REQUIRED } from '@/services/AuthService';
import type { UsernameRename } from '@/types';

/** What the dialog shows. */
interface RenamePrompt {
  /** The name the account holds now, or null when it is not known. */
  currentName: string | null;
  /** The server's suggestion, or null to start the field empty. */
  suggestion: string | null;
}

/** What the dev route shows: a name that breaks the rule, and its cleaned suggestion. */
const DEV_SAMPLE: RenamePrompt = { currentName: 'Ann Lee', suggestion: 'Ann_Lee' };

interface UsernameRenameDialogProps {
  prompt: RenamePrompt;
  /** Runs after a rename and on Later alike. */
  onClose: () => void;
}

/**
 * The rename a flagged account owes before account features work again.
 *
 * Closing it leaves local play untouched; the server keeps refusing account writes until the rename.
 */
export function UsernameRenameDialog({ prompt, onClose }: UsernameRenameDialogProps) {
  const [name, setName] = useState(prompt.suggestion ?? '');
  const mounted = useMountedRef();
  const { error, clearError, busy, submit } = useRenameSubmit((user) => {
    toast.success(`Username changed to ${user.username}`);
    if (mounted.current) onClose();
  });
  const save = () => submit(name);

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent surface="usernameRename" aria-describedby={undefined} className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Choose a New Username</DialogTitle>
        </DialogHeader>

        <form
          id="username-rename"
          className="py-2 text-label space-y-3 min-w-0"
          onSubmit={(event) => { event.preventDefault(); void save(); }}
        >
          <p>
            {USERNAME_RULE_INTRO}
            {prompt.currentName ? <>, and <span className="font-medium break-all">{prompt.currentName}</span> doesn&apos;t fit it</> : null}.
            Choose a new name to keep using Community Creations.
          </p>
          <p className="text-muted-foreground">
            Your games and saves aren&apos;t affected. After this, you log in with the new name.
          </p>

          <div className="space-y-2">
            <label htmlFor="username-rename-field" className="text-label font-medium">New Username</label>
            <Input
              id="username-rename-field"
              value={name}
              onChange={(event) => { setName(event.target.value); clearError(); }}
              aria-invalid={error ? true : undefined}
              aria-describedby="username-rename-help"
              autoComplete="username"
              disabled={busy}
            />
            {error
              ? <p id="username-rename-help" role="alert" className="text-meta text-destructive">{error}</p>
              : <p id="username-rename-help" className="text-meta text-muted-foreground">{USERNAME_RULE_HELP}</p>}
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Later</Button>
          <Button type="submit" form="username-rename" disabled={busy}>
            {busy ? 'Saving…' : 'Save Username'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The held account's rename demand, or null when it owes none. */
function heldDemand(): UsernameRename | null {
  const demand = AuthService.getCurrentUser()?.usernameRename;
  return demand?.required ? demand : null;
}

/**
 * The one rename dialog the app raises.
 *
 * Asks once per session, at app start or sign-in, from the account payload; "Later" holds until the next
 * session. A write refused with the rename code asks again at once. Waits behind the age gate, the sign-in
 * dialog and the Privacy Policy prompt, which the server answers first. Mounted before the views so its
 * `fetch` watch is in place before any screen asks for anything.
 */
export function UsernameRenameGate() {
  const [prompt, setPrompt] = useState<RenamePrompt | null>(null);
  const { attested } = useAgeGate();
  const { promptOpen } = usePrivacyPolicy();
  const signIn = useSyncExternalStore(subscribeSignIn, getSignInState);
  const devRoute = useDevRoute();
  const mounted = useMountedRef();

  // The token the dialog last asked under; a new one is a new session.
  const askedFor = useRef<string | null>(null);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const raise = useCallback((demand: UsernameRename) => {
    askedFor.current = AuthService.token;
    setPrompt({ currentName: AuthService.getCurrentUser()?.username ?? null, suggestion: demand.suggestion });
  }, []);

  const check = useCallback(() => {
    const demand = AuthService.isAuthenticated() ? heldDemand() : null;
    // A rename made elsewhere, in another tab or on the site, closes what is open here.
    if (!demand) {
      setPrompt(null);
      return;
    }
    if (askedFor.current !== AuthService.token) {
      raise(demand);
      return;
    }
    // The boot profile read lands after app start asked from the stored account; its suggestion is current.
    setPrompt((open) => (open && open.suggestion !== demand.suggestion ? { ...open, suggestion: demand.suggestion } : open));
  }, [raise]);

  // App start reads the held account; the boot profile read and every sign-in arrive as a change.
  useEffect(() => {
    check();
    return AuthService.onSessionChanged(check);
  }, [check]);

  useEffect(() => AuthService.onSessionEnded(() => {
    askedFor.current = null;
    setPrompt(null);
  }), []);

  // A refused write reads the account fresh, so the suggestion is current, then asks even after "Later".
  const reading = useRef(false);
  useEffect(() => watchRefusals(AuthService.API_URL, USERNAME_RENAME_REQUIRED, () => {
    if (promptRef.current || reading.current) return;
    reading.current = true;
    void AuthService.fetchUserProfile().then(() => {
      const demand = heldDemand();
      if (mounted.current && demand && !promptRef.current) raise(demand);
    }).finally(() => { reading.current = false; });
  }), [raise, mounted]);

  // DEV: `#dev?modal=usernameRename` raises the dialog on a canned name, since only a flagged account reaches it.
  useEffect(() => {
    if (import.meta.env.DEV && devRoute?.modal === 'usernameRename') setPrompt(DEV_SAMPLE);
  }, [devRoute?.modal]);

  const close = useCallback(() => setPrompt(null), []);

  if (!prompt || !attested || promptOpen || signIn.phase !== 'idle') return null;

  // Keyed on the suggestion, so a fresher one replaces the field's starting value.
  return <UsernameRenameDialog key={prompt.suggestion ?? ''} prompt={prompt} onClose={close} />;
}
