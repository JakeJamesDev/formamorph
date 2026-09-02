import type { FeedItem, FollowedUser, LikeGiven, ProfileCreation, PublicProfile } from '@/types';
import { kindOf } from '@/lib/catalogKinds';
import AuthService from '@/services/AuthService';

/**
 * A catalog row as the server sends it, narrowed to the fields a profile listing reads.
 *
 * Snake_case because that is the table's vocabulary, and `_id` alongside `id` because rows have carried
 * both since the store the catalog was moved off of.
 */
interface RawCreation {
  _id?: string;
  id?: string;
  name: string;
  kind?: string;
  thumbnail_file?: string | null;
  downloads?: number;
  comment_count?: number;
  likes?: number;
  updated_at: string;
  created_at: string;
  quarantined_at?: string | null;
}

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

    const profile = body.data as PublicProfile;

    // The three counts are read straight onto the screen, so they are coerced here rather than defaulted
    // at each of the two places that draw them. A server that predates them sends none — the client can
    // reach people before the server it talks to is updated — and a missing number would render as an
    // icon beside nothing.
    return {
      ...profile,
      followers: Number(profile.followers) || 0,
      likes: Number(profile.likes) || 0,
      downloads: Number(profile.downloads) || 0,
    };
  }

  /**
   * What somebody has published, newest first.
   *
   * Asks for every kind in one request and lets the caller split it: three requests to fill one list
   * would be three round trips to draw the same rows, and the counts beside the kind filter need the
   * whole set anyway.
   *
   * The token is sent when there is one, and it is what decides whether a quarantined listing comes
   * back at all — an author looking at their own profile, and the staff, see them; nobody else does.
   *
   * @param userId - Whose work to list
   * @returns Their listings, newest first
   */
  async fetchCreations(userId: string): Promise<ProfileCreation[]> {
    const response = await fetch(
      `${this.apiUrl}/users/${encodeURIComponent(userId)}/worlds?kind=all`,
      { headers: this.authHeaders() }
    );
    const body = await this.unwrap<{ data: RawCreation[] }>(response, 'Failed to load their creations');

    return body.data.map((row) => ({
      id: String(row._id ?? row.id ?? ''),
      name: row.name,
      kind: kindOf(row),
      thumbnailFile: row.thumbnail_file ?? null,
      downloads: Number(row.downloads) || 0,
      commentCount: Number(row.comment_count) || 0,
      likes: Number(row.likes) || 0,
      updatedAt: row.updated_at,
      createdAt: row.created_at,
      // A timestamp on the row is the whole signal; the server has already decided whether this reader
      // may see the row at all.
      quarantined: Boolean(row.quarantined_at),
    }));
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

  /**
   * What one account has liked, newest first. Staff only.
   *
   * The count comes back beside the rows, which the server caps: an account with more likes than the
   * cap is exactly the one worth looking at, so the number has to be the real one.
   *
   * @param userId - Whose likes to list
   * @returns The full count, and as many liked listings as the server will send
   */
  async fetchLikesGiven(userId: string): Promise<{ total: number; rows: LikeGiven[] }> {
    const response = await fetch(`${this.apiUrl}/users/${encodeURIComponent(userId)}/likes`, {
      headers: this.authHeaders(),
    });
    const body = await this.unwrap<{ data: { total?: number; rows?: LikeGiven[] } }>(
      response,
      'Failed to load what they liked'
    );

    return { total: Number(body.data?.total) || 0, rows: body.data?.rows ?? [] };
  }

  /**
   * Take back every like one account has given. Staff only.
   *
   * One action rather than a row at a time: the reason to reach for it is a throwaway account whose
   * whole footprint is the problem, and removing forty likes by hand is how half of them get left.
   *
   * @param userId - Whose likes to clear
   * @returns How many were removed
   */
  async clearLikesGiven(userId: string): Promise<number> {
    const response = await fetch(`${this.apiUrl}/users/${encodeURIComponent(userId)}/likes`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    const body = await this.unwrap<{ data: { removed?: number } }>(
      response,
      'Failed to clear their likes'
    );

    return Number(body.data?.removed) || 0;
  }
}

export default new UserService();
