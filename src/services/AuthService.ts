import type { AuthUser } from '@/types';

/** What a sign-in tells the caller beyond the session it establishes. */
export interface LoginResult {
  /** The sign-in found a pending account deletion and called it off. Worth saying out loud. */
  deletionCancelled: boolean;
}

/** Singleton holding the auth token and current user, mirrored to `localStorage`. Default-exported as
 *  one shared instance; the constructor rehydrates both from storage (tolerating a corrupt user blob)
 *  and then follows the `storage` event, so a sign-in or sign-out in another tab reaches this one. */
class AuthService {
  API_URL: string;
  tokenKey: string;
  userKey: string;
  token: string | null;
  currentUser: AuthUser | null;
  /** Told whenever the held session ends, so a surface keeping its own copy of the identity can drop it.
   *  Signing out is raised from more than one place now — the profile dialog, the privacy prompt, and a
   *  401 answering any request — and only this service sees all three. */
  private sessionEndedListeners = new Set<() => void>();
  /** Told when another tab hands this one a signed-in session, so a surface holding its own copy of the
   *  identity can pick it up. The site pages and the game are separate builds on one origin, so a sign-in
   *  on either reaches the other only through the `storage` event below. */
  private sessionAdoptedListeners = new Set<() => void>();

  constructor() {
    // Use different API URL based on environment
    this.API_URL = import.meta.env.MODE === 'production'
      ? import.meta.env.VITE_API_URL_PROD
      : import.meta.env.VITE_API_URL_DEV;
    this.tokenKey = 'authToken';
    this.userKey = 'currentUser';
    const stored = this.readStoredSession();
    this.token = stored.token;
    this.currentUser = stored.user;

    // Never removed: the singleton lives as long as the document does.
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorage);
    }
  }

  /** The token and user as `localStorage` currently holds them, tolerating a corrupt user blob. */
  private readStoredSession(): { token: string | null; user: AuthUser | null } {
    // A browser set to refuse site data throws on the read rather than answering null, and an unreadable
    // user blob throws on the parse. Unguarded, either would throw during construction and again on
    // every foreign write — inside an event handler, where nothing would catch it.
    try {
      const token = localStorage.getItem(this.tokenKey);
      let user: AuthUser | null = null;
      try {
        user = JSON.parse(localStorage.getItem(this.userKey) || 'null');
      } catch {
        user = null;
      }
      return { token, user };
    } catch {
      return { token: null, user: null };
    }
  }

  /**
   * Follow a sign-in or sign-out another tab performed.
   *
   * The `storage` event fires only in the other tabs, which is the whole case: signing in at `/login`
   * has to reach an open `/play/`, and signing out at either has to reach the other. The write itself
   * is already done by the time this runs, so the stored values are read back rather than taken from
   * the event — one event carries one key, and the session is two.
   */
  private handleStorage = (event: StorageEvent) => {
    // A null key is `localStorage.clear()`, which takes the session with it.
    if (event.key !== null && event.key !== this.tokenKey && event.key !== this.userKey) return;

    const { token, user } = this.readStoredSession();
    const unchanged = token === this.token
      && JSON.stringify(user ?? null) === JSON.stringify(this.currentUser ?? null);
    if (unchanged) return;

    const wasAuthenticated = !!this.token;
    this.token = token;
    this.currentUser = user;

    // A foreign sign-out reaches the same listeners a local one does: every surface that drops an
    // identity is already subscribed there, and the two cases want the same thing done.
    if (wasAuthenticated && !token) this.notify(this.sessionEndedListeners);
    if (token) this.notify(this.sessionAdoptedListeners);
  };

  /** Run every listener, isolating each: one throwing must not strand the others or escape the caller. */
  private notify(listeners: Set<() => void>) {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('A session listener failed:', error);
      }
    });
  }

  /** Whether a token is held (presence check only — does not validate it against the server). */
  isAuthenticated() {
    return !!this.token;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  /** Listen for the session ending. Returns the unsubscribe. */
  onSessionEnded(listener: () => void): () => void {
    this.sessionEndedListeners.add(listener);
    return () => { this.sessionEndedListeners.delete(listener); };
  }

  /** Listen for another tab handing this one a signed-in session. Returns the unsubscribe. */
  onSessionAdopted(listener: () => void): () => void {
    this.sessionAdoptedListeners.add(listener);
    return () => { this.sessionAdoptedListeners.delete(listener); };
  }

  /** Authenticate, persist the token, then adopt or fetch the user profile; rethrows on failure.
   *  Reports whether the sign-in cancelled a pending deletion, which is the only place that is said. */
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      const response = await fetch(`${this.API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();

      this.token = data.token;
      localStorage.setItem(this.tokenKey, data.token);

      // If the login response includes user data, store it
      if (data.user) {
        this.currentUser = data.user;
        localStorage.setItem(this.userKey, JSON.stringify(data.user));
      } else {
        // Otherwise, fetch user profile
        await this.fetchUserProfile();
      }

      return { deletionCancelled: data.deletionCancelled === true };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /** Validate credentials client-side, register, persist the token, and resolve the user profile
   *  (falling back to a bare `{username}` if the server returns none); rethrows on failure. */
  async register(username: string, password: string, email = '') {
    try {
      // Validate username and password according to server requirements
      if (!username || username.length < 3 || username.length > 20) {
        throw new Error('Username must be between 3 and 20 characters');
      }

      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Validate email format if provided
      if (email && !this.isValidEmail(email)) {
        throw new Error('Invalid email format');
      }

      const requestBody: { username: string; password: string; email?: string } = { username, password };
      if (email) {
        requestBody.email = email;
      }

      const response = await fetch(`${this.API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();

      this.token = data.token;
      localStorage.setItem(this.tokenKey, data.token);

      // If the registration response includes user data, store it
      if (data.user) {
        this.currentUser = data.user;
        localStorage.setItem(this.userKey, JSON.stringify(data.user));
      } else {
        // Otherwise, fetch user profile
        await this.fetchUserProfile();
      }

      // If we still don't have a username, create a basic user object with the username
      if (!this.currentUser || !this.currentUser.username) {
        this.currentUser = { username };
        localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
      }

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /** Fetch and cache the profile for the held token; a `401` triggers `logout()` and returns `null`.
   *  On other errors falls back to any stored/known user rather than clearing it. */
  async fetchUserProfile() {
    try {
      if (!this.token) return null;

      const response = await fetch(`${this.API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          this.logout();
          return null;
        }
        throw new Error('Failed to fetch user profile');
      }

      const userData = await response.json();

      // Handle different possible response structures
      let userObject = userData;
      if (userData.user) {
        userObject = userData.user;
      }

      // Ensure we have a username
      if (!userObject.username && this.currentUser && this.currentUser.username) {
        userObject.username = this.currentUser.username;
      }

      this.currentUser = userObject;
      localStorage.setItem(this.userKey, JSON.stringify(userObject));

      return userObject;
    } catch (error) {
      console.error('Error fetching user profile:', error);

      // If we have a username from login/register, create a basic user object
      if (!this.currentUser || !this.currentUser.username) {
        const storedUser = JSON.parse(localStorage.getItem(this.userKey) || 'null');
        if (storedUser && storedUser.username) {
          this.currentUser = storedUser;
        }
      }

      return this.currentUser;
    }
  }

  /** Change the password for the held token, adopting the replacement token the server issues; throws if
   *  unauthenticated or the request fails. Changing the password retires every token signed under the old
   *  one, this session's included — without adopting the replacement the next request would 401. */
  async changePassword(currentPassword: string, newPassword: string) {
    try {
      if (!this.token) throw new Error('Not authenticated');

      const response = await fetch(`${this.API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!response.ok) {
        // This API answers with `error`; a suspended account's rejection lands here and is worth
        // showing verbatim rather than as a generic failure.
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to change password');
      }

      // Tolerated as absent so an app pointed at a server predating the replacement token keeps working:
      // that session stays valid there, because nothing retired it.
      const data = await response.json().catch(() => ({}));
      if (data.token) {
        this.token = data.token;
        localStorage.setItem(this.tokenKey, data.token);
      }

      return true;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Ask for this account to be erased once the grace period runs out.
   *
   * The password goes with the request because the session alone is not enough to end an account — a
   * stolen token must not be able to. Nothing changes until the window closes, and signing in before
   * then calls the whole thing off.
   *
   * @param password - The account's own password, re-entered
   * @param deleteContent - Whether published listings and comments go too. The server refuses a body
   *   without it, so there is no default here either
   * @returns When the erasure runs, as an ISO timestamp
   */
  async requestAccountDeletion(password: string, deleteContent: boolean): Promise<string> {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.API_URL}/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ password, deleteContent })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // A wrong password and a suspended account both answer here, and both sentences are worth
      // showing verbatim: they are the two things the user has to act on.
      throw new Error(data.error || data.message || 'Failed to request the deletion');
    }

    return data.deletionScheduledFor as string;
  }

  /**
   * Replace the signed-in account's profile image and adopt the new URL locally.
   *
   * The cached user is updated in place rather than re-fetched: every surface reads the avatar from its
   * own DTO, and the one thing that must change immediately is the reader's own face in the header.
   *
   * @param image - A `data:image/(webp|png);base64,...` URI from the crop step
   * @returns The new avatar URL
   */
  async setAvatar(image: string): Promise<string | null> {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.API_URL}/users/me/avatar`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ image })
    });

    const data = await response.json();
    if (!response.ok) {
      // A suspended account's refusal lands here and is worth showing verbatim.
      throw new Error(data.error || data.message || 'Failed to save the profile image');
    }

    const avatarUrl: string | null = data.data?.avatarUrl ?? null;
    this.applyAvatar(avatarUrl);

    return avatarUrl;
  }

  /** Remove the signed-in account's profile image. */
  async removeAvatar(): Promise<void> {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.API_URL}/users/me/avatar`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || data.message || 'Failed to remove the profile image');
    }

    this.applyAvatar(null);
  }

  /**
   * Clear somebody else's profile image. Admins only; the server records it in the audit log.
   *
   * @param userId - Whose image to remove
   */
  async removeUserAvatar(userId: string): Promise<void> {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${this.API_URL}/users/${userId}/avatar`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || data.message || 'Failed to remove the profile image');
    }
  }

  /** Write an avatar URL into the cached user, so the header changes without a round trip. */
  applyAvatar(avatarUrl: string | null) {
    if (!this.currentUser) return;

    this.currentUser = { ...this.currentUser, avatarUrl };
    localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
  }

  /** Loose format check for the optional registration email. */
  isValidEmail(email: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /** Clear the token and user from memory and `localStorage`; also invoked on a `401` from the server. */
  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    // After the state is cleared, so a listener that reads `isAuthenticated()` sees the session gone.
    this.notify(this.sessionEndedListeners);
  }
}

export default new AuthService();
