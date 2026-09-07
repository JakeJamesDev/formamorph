import { useEffect, useState } from 'react';
import { LogOut, Monitor, Moon, Settings, Sun, User } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import * as Popover from '@radix-ui/react-popover';
import { useTheme } from '@/components/theme-provider';
import AuthService from '@/services/AuthService';
import type { AuthUser } from '@/types';
import { withAgeGateAuthentication } from '@/lib/ageGateAuthentication';
import { useSiteAgeGateAuthentication } from '../ageGateAuthenticationContext';

interface SiteSession {
  authenticated: boolean;
  user: AuthUser | null;
}

const readSession = (): SiteSession => ({
  authenticated: AuthService.isAuthenticated(),
  user: AuthService.getCurrentUser(),
});

/** The account links shared by every website page. */
export function SiteAccountControls({ signInPath = '/login' }: { signInPath?: string }) {
  const { theme, setTheme } = useTheme();
  const [session, setSession] = useState(readSession);
  const authentication = useSiteAgeGateAuthentication();

  useEffect(() => AuthService.onSessionChanged(() => setSession(readSession())), []);

  if (!session.authenticated) {
    return (
      <a
        href={withAgeGateAuthentication(signInPath, authentication.flow)}
        onClick={authentication.continueAuthentication}
        data-account className="fm-sign-in"
      >
        <User aria-hidden="true" />Sign In
      </a>
    );
  }

  const username = session.user?.username;
  // Cast because `AuthUser` keeps server additions unknown; avatarUrl is a nullable string in the DTO.
  const avatarUrl = (session.user?.avatarUrl as string | null | undefined) ?? null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" aria-label="Account menu" data-account className="fm-avatar-button">
          <UserAvatar username={username ?? 'Account'} avatarUrl={avatarUrl} size="sm" className="fm-site-avatar" />
        </button>
      </Popover.Trigger>
      <Popover.Portal><Popover.Content align="end" sideOffset={8} collisionPadding={12} className="fm-account-menu" aria-label="Account">
        <nav aria-label="Account" className="fm-account-links">
          {username && (
            <a
              href={`/u/${encodeURIComponent(username)}`}
              aria-label="Profile"
              className="fm-menu-item"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Profile</span>
            </a>
          )}
          <a href="/account" className="fm-menu-item"><Settings className="h-4 w-4" aria-hidden="true" />Account Settings</a>
          <hr />
          <div className="fm-theme-row">
            <span>Appearance</span>
            <div className="fm-theme-toggle" role="group" aria-label="Color theme">
              <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun aria-hidden="true" />Light</button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon aria-hidden="true" />Dark</button>
              <button type="button" aria-pressed={theme === 'system'} onClick={() => setTheme('system')}><Monitor aria-hidden="true" />System</button>
            </div>
          </div>
          <hr />
          <button
            type="button"
            className="fm-menu-item"
            onClick={() => AuthService.logout()}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </button>
        </nav>
      </Popover.Content></Popover.Portal>
    </Popover.Root>
  );
}
