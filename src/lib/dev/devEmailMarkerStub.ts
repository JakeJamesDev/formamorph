/** DEV only: shows an account whose address is marked, while the fixture is `emailMarker-bounce` or `emailMarker-complaint`. */
import AuthService, { isEmailMarker } from '@/services/AuthService';
import type { AuthUser, EmailMarker } from '@/types';

const FIXTURE_PREFIX = 'emailMarker-';
const SAMPLE_ADDRESS = 'player@example.com';
const STUBBED = ['isAuthenticated', 'getCurrentUser', 'fetchEmailState', 'setEmail', 'resendVerification'] as const;

let stubbed: EmailMarker | null = null;
let user: AuthUser = { username: 'dev_player' };

/** The marker a fixture name asks for, or null for any other fixture. */
export function emailMarkerFixture(fixture: string | null | undefined): EmailMarker | null {
  const reason = fixture?.startsWith(FIXTURE_PREFIX) ? fixture.slice(FIXTURE_PREFIX.length) : null;
  return isEmailMarker(reason) ? reason : null;
}

/**
 * Shadows the account calls with a marked sample account; null deletes the shadows. Saving another
 * address clears the marker and reports the mail as sent, as the server does.
 */
export function applyDevEmailMarker(reason: EmailMarker | null): void {
  if (!import.meta.env.DEV || reason === stubbed) return;
  for (const key of STUBBED) delete (AuthService as Partial<typeof AuthService>)[key];
  stubbed = reason;
  if (!reason) return;

  user = { ...(AuthService.getCurrentUser() ?? { username: 'dev_player' }), email: SAMPLE_ADDRESS, emailVerified: false, emailMarker: reason };
  Object.assign(AuthService, {
    isAuthenticated: () => true,
    getCurrentUser: () => user,
    fetchEmailState: async () => ({ email: user.email as string, emailVerified: false, emailMarker: user.emailMarker ?? null }),
    setEmail: async (email: string) => {
      if (email.toLowerCase() === String(user.email).toLowerCase() && user.emailMarker) {
        return { emailVerified: false, mailSent: false, undeliverable: user.emailMarker };
      }
      user = { ...user, email, emailVerified: false, emailMarker: null };
      return { emailVerified: false, mailSent: true, undeliverable: null };
    },
    resendVerification: async () => (user.emailMarker
      ? { emailVerified: false, mailSent: false, undeliverable: user.emailMarker }
      : { emailVerified: false, mailSent: true, undeliverable: null }),
  });
}

/** Site: reads `?fixture=` once, before the first render. A no-op outside DEV. */
export function installSiteEmailMarkerStub(): void {
  if (!import.meta.env.DEV) return;
  applyDevEmailMarker(emailMarkerFixture(new URLSearchParams(window.location.search).get('fixture')));
}
