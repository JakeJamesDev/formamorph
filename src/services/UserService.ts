import type { PublicProfile } from '@/types';

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
   * No token: the catalog and its comments are open to signed-out visitors, so a name they can read is
   * a name they can click.
   *
   * @param userId - Whose profile to read
   * @returns Their public profile
   */
  async fetchProfile(userId: string): Promise<PublicProfile> {
    const response = await fetch(`${this.apiUrl}/users/${encodeURIComponent(userId)}/profile`);
    const body = await response.json().catch(() => ({}));

    if (!response.ok || !body?.success) {
      throw new Error(body?.error || 'Failed to load this profile');
    }

    return body.data as PublicProfile;
  }
}

export default new UserService();
