import AuthService from '@/services/AuthService';
import WorldStorageService from '@/services/WorldStorageService';

/**
 * Where a guest's likes become an account's.
 *
 * A guest's hearts are addressed by this copy of the app, and an account's by the account. Signing in
 * changes which of the two the server is asked about, so without this the likes somebody gave before
 * they had an account would simply stop being theirs. The Claim moves them, and the server remembers
 * which account took this Install, so signing out is not a way to like the same listing twice.
 *
 * The server setting does not gate this. A person who liked before the operator switched Anonymous Likes
 * off must still be able to take those likes to an account, so nothing here reads the flag.
 */

/** The session the last Claim was asked for, so one session asks once. */
let claimedFor: string | null = null;

/** The Claim in the air, so a catalog read can wait for it rather than answering with stale hearts. */
let inFlight: Promise<void> | null = null;

/** The held session as one string. An avatar write changes the user and not this. */
const sessionIdentity = (): string =>
  `${AuthService.token ?? ''}:${AuthService.getCurrentUser()?.id ?? ''}`;

/**
 * Move this Install's Anonymous Likes to the session in hand, if there is one and it is new.
 *
 * Nothing is awaited here: a Claim that hangs or fails must not hold up the sign-in that started it. A
 * failure forgets the session instead, so the next session change asks again.
 */
function claimForSession(): void {
  if (!AuthService.isAuthenticated()) {
    claimedFor = null;
    return;
  }

  const session = sessionIdentity();
  if (session === claimedFor) return;
  claimedFor = session;

  const run: Promise<void> = WorldStorageService.claimAnonymousLikes()
    .then(() => {})
    .catch((error) => {
      claimedFor = null;
      console.error('Failed to claim the likes given before sign-in:', error);
    })
    .finally(() => {
      // Only if it is still this one: a later Claim may have started while this was in the air.
      if (inFlight === run) inFlight = null;
    });

  inFlight = run;
}

/**
 * Watch the session for the three ways one arrives: a sign-in, a sign-up, and a sign-in in another tab
 * reaching this one. All three end in the same notification, so all three are caught here.
 *
 * @returns The unsubscribe
 */
export function watchSessionForClaim(): () => void {
  return AuthService.onSessionChanged(claimForSession);
}

/**
 * Wait for a Claim in the air to finish, so what is read next has the moved likes in it.
 *
 * The reader changes the moment the session does, so a catalog refresh starts while the Claim is still
 * going. Read without waiting and the account's new hearts are missing from the answer.
 *
 * It never rejects: a Claim that failed is not the caller's to report, and the catalog is still worth
 * reading.
 */
export async function claimSettled(): Promise<void> {
  const pending = inFlight;
  if (pending) await pending;
}
