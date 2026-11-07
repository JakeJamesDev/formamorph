import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';

/** Whether this server accepts a like from a reader with no account. */
export const ANONYMOUS_LIKES = 'anonymous_likes';

/** Whether new listings and updates wait for a mod. Only a server with listing review knows the key. */
export const LISTING_REVIEW = 'listing_review';

/** Whether the server records the kind of network beside each like. */
export const NETWORK_KIND = 'network_kind';

/** Whether the server stores each install's Daily Send. */
export const ACTIVE_INSTALLS = 'active_installs';

/** The fewest flagged likes that mark a listing. */
export const LIKES_MARKER_MIN_FLAGGED = 'likes_marker_min_flagged';

/** The share of a listing's recent likes that, once flagged, marks it. Stored as 0 to 1. */
export const LIKES_MARKER_SHARE = 'likes_marker_share';

/** The fewest different likers inside the window that make a Burst. */
export const BURST_SIZE = 'burst_size';

/** How many minutes a Burst may span. */
export const BURST_WINDOW_MINUTES = 'burst_window_minutes';

/** The on/off settings this client reads and writes. The server declares more and refuses any other key. */
export type ServerSettingKey = typeof ANONYMOUS_LIKES | typeof LISTING_REVIEW | typeof NETWORK_KIND
  | typeof ACTIVE_INSTALLS;

/** The numeric settings this client reads and writes. */
export type ServerNumberKey = typeof LIKES_MARKER_MIN_FLAGGED | typeof LIKES_MARKER_SHARE
  | typeof BURST_SIZE | typeof BURST_WINDOW_MINUTES;

/** The number a settings response carries. Anything else is an error, never a default. */
function numberOf(body: { data: unknown }): number {
  if (typeof body.data !== 'number') throw new Error('The server sent no number for this setting');
  return body.data;
}

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
    const body = await this.read(key);
    return body.data === true;
  }

  /** Write one on/off setting. Returns the value the server stored, not the value sent. */
  async saveSetting(key: ServerSettingKey, value: boolean): Promise<boolean> {
    const body = await this.write(key, value);
    return body.data === true;
  }

  /** One numeric setting as the server stores it, or its default while none is stored. */
  async fetchNumber(key: ServerNumberKey): Promise<number> {
    return numberOf(await this.read(key));
  }

  /** Write one numeric setting. Returns the value the server stored. A value the server refuses throws its reason. */
  async saveNumber(key: ServerNumberKey, value: number): Promise<number> {
    return numberOf(await this.write(key, value));
  }

  private async read(key: string) {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, { headers: authHeaders() });
    return unwrap<{ data: unknown }>(response, 'Failed to read the setting');
  }

  private async write(key: string, value: boolean | number) {
    const response = await fetch(`${this.apiUrl}/settings/${key}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ value }),
    });

    return unwrap<{ data: unknown }>(response, 'Failed to write the setting');
  }
}

export default new ServerSettingsService();
