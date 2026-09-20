import AuthService from './AuthService';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** Whether this server takes a like from somebody who is not signed in. */
export const ANONYMOUS_LIKES = 'anonymous_likes';

/**
 * The settings staff change without a deploy.
 *
 * The server declares every key it has and refuses the rest, so this only names the ones with a control.
 * There is no public read: a client learns a setting by being refused by it, which is why nothing outside
 * the Admin Panel asks here.
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

  /** One on/off setting as the server holds it. Anything but a stored `true` reads as off. */
  async fetchFlag(key: string): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: unknown }>(response, 'Failed to read the setting');
    return body.data === true;
  }

  /** Write one on/off setting, and answer with the value the server stored rather than the one sent. */
  async saveFlag(key: string, value: boolean): Promise<boolean> {
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
