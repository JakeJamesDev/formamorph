// @ts-check
/**
 * The signed-in reader, for a page that ships without a bundler.
 *
 * The landing page is one static file, the account pages are a React entry, and the game is a third
 * build — but all three are the same origin, so all three read one session out of `localStorage`. This
 * is the vanilla half of it: the keys AuthService writes, a read of them, and the cross-tab event.
 * `site/session.test.ts` pins the keys and the origin to what the app itself uses.
 */

/** Where the session token is held. AuthService writes it; nothing here ever does. */
export const TOKEN_KEY = 'authToken';

/** Where the signed-in user's DTO is held, as JSON. */
export const USER_KEY = 'currentUser';

/** The one-navigation notice a site login leaves for its destination. */
export const DELETION_CANCELLATION_KEY = 'FORMAMORPH_deletionCancellation';

/**
 * Where a stored avatar loads from. The tracked site is the production site, so this is the production
 * API's origin — the same host `VITE_API_URL_PROD` names, without its `/api` suffix, because the paths
 * the server hands out already start with `/api`.
 */
export const API_ORIGIN = 'https://api.formamorph.ai';

/**
 * @typedef {object} Session
 * @property {string} username
 * @property {string | null} avatarUrl
 */

/**
 * Who is signed in, or null.
 *
 * A token with no readable username reads as signed out: every use here is a link to that person's
 * profile, and there is no profile to point at without a name.
 *
 * @returns {Session | null}
 */
export function readSession() {
  let token = null;
  let raw = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
    raw = localStorage.getItem(USER_KEY);
  } catch {
    // A browser set to refuse site data throws on the read rather than answering null.
    return null;
  }
  if (!token) return null;

  let user = null;
  try {
    user = JSON.parse(raw || 'null');
  } catch {
    return null;
  }
  if (!user || typeof user.username !== 'string' || !user.username) return null;

  return {
    username: user.username,
    avatarUrl: typeof user.avatarUrl === 'string' && user.avatarUrl ? user.avatarUrl : null,
  };
}

/**
 * Follow the session across tabs.
 *
 * The `storage` event fires only in the other tabs, which is exactly the case this covers: signing in
 * at `/play/` or on `/login` has to reach a landing page already open beside it.
 *
 * @param {(session: Session | null) => void} onChange - Told the new session on every relevant write
 * @returns {() => void} The unsubscribe
 */
export function watchSession(onChange) {
  /** @param {StorageEvent} event */
  const read = (event) => {
    // A null key is `localStorage.clear()`, which takes the session with it.
    if (event.key !== null && event.key !== TOKEN_KEY && event.key !== USER_KEY) return;
    onChange(readSession());
  };

  window.addEventListener('storage', read);
  return () => window.removeEventListener('storage', read);
}

/**
 * The full URL of a stored avatar.
 *
 * The server answers with a root-relative path because it does not know what host the client reached
 * it on. Anything else already says where it comes from and is left alone.
 *
 * @param {string | null | undefined} avatarUrl - The `avatarUrl` from the stored user
 * @returns {string | null}
 */
export function avatarSrc(avatarUrl) {
  if (!avatarUrl) return null;
  return avatarUrl.startsWith('/') ? `${API_ORIGIN}${avatarUrl}` : avatarUrl;
}

/** Read and clear a pending account-deletion cancellation notice. */
export function takeDeletionCancellation() {
  try {
    if (sessionStorage.getItem(DELETION_CANCELLATION_KEY) !== 'true') return false;
    sessionStorage.removeItem(DELETION_CANCELLATION_KEY);
    return true;
  } catch {
    return false;
  }
}
