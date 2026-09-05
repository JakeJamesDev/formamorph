import { useEffect } from 'react';
import AuthService from '@/services/AuthService';
import { leaveTo } from '../leaveSite';
import { signInTo } from '../nextPath';
import { SiteLayout } from '../components/SiteLayout';

/** Where `/profile` sends a reader who has no session: sign in, then come back here. */
const SIGN_IN = signInTo('/profile');

/**
 * `/profile` — the link a player can follow without knowing how their own name is spelled in a URL.
 *
 * It holds nothing of its own. A session names the profile to open; no session means the reader has to
 * sign in first, and the return path brings them back to this same redirect rather than to a name the
 * link could not have known.
 */
export function OwnProfilePage() {
  const username = AuthService.getCurrentUser()?.username;

  useEffect(() => {
    leaveTo(username ? `/u/${encodeURIComponent(username)}` : SIGN_IN);
  }, [username]);

  // On screen only for the moment the browser takes to leave, so it says where, not nothing.
  return (
    <SiteLayout title="Your Profile">
      <p className="text-body text-muted-foreground">
        {username ? 'Opening your profile…' : 'Taking you to sign in…'}
      </p>
    </SiteLayout>
  );
}
