import { useEffect, useState } from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import AuthService from '@/services/AuthService';
import type { AuthUser } from '@/types';

interface SiteSession {
  authenticated: boolean;
  user: AuthUser | null;
}

const readSession = (): SiteSession => ({
  authenticated: AuthService.isAuthenticated(),
  user: AuthService.getCurrentUser(),
});

/** The account links shared by every React site page. */
export function SiteAccountControls() {
  const [session, setSession] = useState(readSession);

  useEffect(() => AuthService.onSessionChanged(() => setSession(readSession())), []);

  if (!session.authenticated) {
    return (
      <a href="/login" className="text-label font-medium text-primary hover:underline">
        Sign In
      </a>
    );
  }

  const username = session.user?.username;
  // Cast because `AuthUser` keeps server additions unknown; avatarUrl is a nullable string in the DTO.
  const avatarUrl = (session.user?.avatarUrl as string | null | undefined) ?? null;

  return (
    <nav aria-label="Account" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-label">
      {username && (
        <a
          href={`/u/${encodeURIComponent(username)}`}
          aria-label="Profile"
          className="flex items-center gap-2 font-medium hover:text-primary"
        >
          <UserAvatar username={username} avatarUrl={avatarUrl} size="sm" />
          <span>Profile</span>
        </a>
      )}
      <a href="/account" className="font-medium hover:text-primary">Account Settings</a>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto px-0 py-1 hover:bg-transparent hover:text-primary"
        onClick={() => AuthService.logout()}
      >
        Sign Out
      </Button>
    </nav>
  );
}
