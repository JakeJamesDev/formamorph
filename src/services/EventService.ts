import AuthService from './AuthService';
import type { ServerEvent } from '@/types';

/** Server error envelope: this API answers with `error`, older handlers read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/**
 * Timed community events — contests and announcements the whole player base sees. Reads a public
 * endpoint, so it works signed out; the token rides along when there is one so the server can tell
 * staff-visible rows apart.
 *
 * Default-exported as one shared instance, matching `AuthService` and `MessageService`.
 */
class EventService {
  private get apiUrl() {
    return AuthService.API_URL;
  }

  /** A bearer header only when signed in — the read surface is public, so an anonymous call is normal. */
  private authHeaders(): HeadersInit {
    return AuthService.token ? { Authorization: `Bearer ${AuthService.token}` } : {};
  }

  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      throw new Error(body.error || body.message || fallback);
    }
    return (await response.json()) as T;
  }

  /** Every event currently running, of every type. Empty on a server that has no events layer. */
  async fetchActive(): Promise<ServerEvent[]> {
    const response = await fetch(`${this.apiUrl}/events/active`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: ServerEvent[] }>(response, 'Failed to load events');
    return body.data ?? [];
  }
}

export default new EventService();
