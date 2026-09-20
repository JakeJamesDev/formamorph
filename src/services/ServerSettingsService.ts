import AuthService from './AuthService';
import { authHeaders, unwrap } from './staffApi';

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

  /** One on/off setting as the server stores it. Any stored value but `true` resolves to off. */
  async fetchSetting(key: ServerSettingKey): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, { headers: authHeaders() });
    const body = await unwrap<{ data: unknown }>(response, 'Failed to read the setting');
    return body.data === true;
  }

  /** Write one on/off setting. Returns the value the server stored, not the value sent. */
  async saveSetting(key: ServerSettingKey, value: boolean): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ value }),
    });

    const body = await unwrap<{ data: unknown }>(response, 'Failed to write the setting');
    return body.data === true;
  }
}

export default new ServerSettingsService();
