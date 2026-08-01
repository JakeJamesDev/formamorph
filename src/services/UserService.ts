import type { FeedItem, FollowedUser, PublicProfile } from '@/types';
import AuthService from '@/services/AuthService';

/**
 * The public face of an account: what a stranger sees when they click a name.
 *
 * Fetched on demand rather than carried by every author DTO — a listing, a comment and a reply each
 * already name their author, and hanging a signup date off all of them would send the same fields a
 * hundred times to fill one popup nobody may open.
 */
class UserService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = import.meta.env.MODE === 'production'
      ? import.meta.env.VITE_API_URL_PROD
      : import.meta.env.VITE_API_URL_DEV;
  }

  /** Where a profile's avatar resolves against. */
  get API_URL(): string {
    return this.apiUrl;
  }

  /**
   * Read one account's public profile.
   *
   * The token is optional but sent when there is one: the endpoint is open to signed-out visitors, and
   * it is the token that decides whether `following` comes back at all. Without it the reader's own
   * follow state is missing, and the button opens saying Follow to somebody who already does.
   *
   * @param userId - Whose profile to read
   * @returns Their public profile
   */
  async fetchProfile(userId: string): Promise<PublicProfile> {
    const response = await fetch(`${this.apiUrl}/users/${encodeURIComponent(userId)}/profile`, {
      headers: this.authHeaders(),
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body?.success) {
      throw new Error(body?.error || 'Failed to load this profile');
    }

    return body.data as PublicProfile;
  }

  /** A bearer header for the signed-in reader. */
  private authHeaders(): HeadersInit {
    return AuthService.token ? { Authorization: `Bearer ${AuthService.token}` } : {};
  }

  /** Read a JSON body, throwing the server's own wording on a refusal. */
  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.success) throw new Error(body?.error || fallback);

    return body as T;
  }

  /**
   * Start or stop following somebody.
   *
   * @param userId - Whose work to follow
   * @param following - True to follow, false to stop
   * @returns The follow state and their new follower count, so the button and the number move together
   */
  async setFollowing(userId: string, following: boolean): Promise<{ following: boolean; followers: number }> {
    const response = await fetch(`${this.apiUrl}/users/${encodeURIComponent(userId)}/follow`, {
      method: following ? 'PUT' : 'DELETE',
      headers: this.authHeaders(),
    });

    const body = await this.unwrap<{ data: { following: boolean; followers: number } }>(
      response,
      following ? 'Failed to follow them' : 'Failed to unfollow them'
    );

    return body.data;
  }

  /** Who the signed-in reader follows, newest first. Nobody sees anybody else's list. */
  async fetchFollowing(): Promise<FollowedUser[]> {
    const response = await fetch(`${this.apiUrl}/users/me/following`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: FollowedUser[] }>(response, 'Failed to load who you follow');

    return body.data;
  }

  /**
   * The notification feed.
   *
   * Reading it marks it read — the feed *is* the notification, so there is nothing else that could
   * clear it. The `unread` it answers with is what was new at the moment it opened.
   *
   * @returns The feed rows and how many of them were new
   */
  async fetchNotifications(): Promise<{ items: FeedItem[]; unread: number }> {
    const response = await fetch(`${this.apiUrl}/users/me/notifications`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: FeedItem[]; unread: number }>(response, 'Failed to load your notifications');

    return { items: body.data, unread: body.unread };
  }

  /** How much of the feed is new, for the badge. Zero for a signed-out reader. */
  async fetchNotificationCount(): Promise<number> {
    if (!AuthService.token) return 0;

    const response = await fetch(`${this.apiUrl}/users/me/notifications/unread-count`, {
      headers: this.authHeaders(),
    });
    if (!response.ok) return 0;

    const body = await response.json().catch(() => ({}));

    return Number(body?.unread) || 0;
  }
}

export default new UserService();
