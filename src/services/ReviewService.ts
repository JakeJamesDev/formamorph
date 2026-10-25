import AuthService from './AuthService';
import { authHeaders } from './authRequest';

/** Whether this server holds new listings for review right now. */
export interface ReviewMeta {
  enabled: boolean;
}

/**
 * Listing review routes.
 *
 * A server without the feature answers `404` on its meta route, so `fetchMeta` answering null is a
 * normal state that every caller handles by hiding its controls.
 */
class ReviewService {
  private get apiUrl() {
    return AuthService.API_URL;
  }

  /**
   * The server's review setting, null when the server has no review, and `undefined` when it could not
   * tell (a `401`, a `5xx`, a dropped connection). Never throws.
   */
  async fetchMeta(): Promise<ReviewMeta | null | undefined> {
    try {
      const response = await fetch(`${this.apiUrl}/reviews/meta`, { headers: authHeaders() });
      if (response.status === 404) return null;
      if (!response.ok) return undefined;

      const body = (await response.json()) as { data?: { enabled?: unknown } };
      if (typeof body.data?.enabled !== 'boolean') return undefined;

      return { enabled: body.data.enabled };
    } catch {
      return undefined;
    }
  }
}

export default new ReviewService();
