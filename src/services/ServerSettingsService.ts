import AuthService from './AuthService';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** Whether this server accepts a like from a reader with no account. */
export const ANONYMOUS_LIKES = 'anonymous_likes';

/** The settings this client reads and writes. The server declares more and refuses any other key. */
export type ServerSettingKey = typeof ANONYMOUS_LIKES;

/**
 * The settings staff change without a deploy.
 *
 * The server has no public read: a client learns a setting by being refused by it. Only the Admin Panel
 * asks here.
 */
class ServerSettingsService {
  private get apiUrl() {
    return AuthService.API_URL;
  }

  private authHeaders(withBody = false): HeadersInit {
    const headers: Record<string, string> = { Authorization: `Bearer ${AuthService.token}` };
    if (withBody) headers['Content-Type'] = 'application/json';
    return headers;
  }

  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      throw new Error(body.error || body.message || fallback);
    }
    return (await response.json()) as T;
  }

  /** One on/off setting as the server stores it. Any stored value but `true` resolves to off. */
  async fetchSetting(key: ServerSettingKey): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: unknown }>(response, 'Failed to read the setting');
    return body.data === true;
  }

  /** Write one on/off setting. Returns the value the server stored, not the value sent. */
  async saveSetting(key: ServerSettingKey, value: boolean): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify({ value }),
    });

    const body = await this.unwrap<{ data: unknown }>(response, 'Failed to write the setting');
    return body.data === true;
  }
}

export default new ServerSettingsService();
