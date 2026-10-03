import { API_BASE_URL } from '@/lib/apiBase';
import AuthService from '@/services/AuthService';
import type { SupporterTier } from '@/types';

/** The caller's own Patreon link, as the server reports it. */
export type PatreonStatus =
  | { linked: false }
  | { linked: true; tier: SupporterTier | null; since: string | null; showFlair: boolean };

/** A refusal from a Patreon route. `code` is the server's machine code when it sent one. */
export class PatreonError extends Error {
  constructor(message: string, readonly code: string | null = null) {
    super(message);
    this.name = 'PatreonError';
  }
}

/** Send one authenticated request to a Patreon route and return its `data`. */
async function request<T>(path: string, method: string, failure: string, body?: unknown): Promise<T> {
  const token = AuthService.token;
  if (!token) throw new PatreonError('Not authenticated');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/users/me/patreon${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PatreonError(failure);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PatreonError(payload.error || payload.message || failure, payload.code ?? null);
  }

  return payload.data as T;
}

/** One row of the Supporters wall, in the order the server sends. */
export interface Supporter {
  id: string;
  username: string;
  avatarUrl: string | null;
  tier: SupporterTier;
  since: string | null;
}

/** The account calls behind the Patreon section. */
export const PatreonService = {
  /** Patreon's approval page for this account. The caller sends the browser there. */
  async startLink(): Promise<string> {
    const { url } = await request<{ url: string }>('/link', 'POST', 'Could not start the link. Try again in a moment.');
    return url;
  },

  getStatus: () => request<PatreonStatus>('', 'GET', 'Could not read your Patreon status.'),

  /** Finish a link. The token comes from the callback's redirect, and the bearer must own the pending link. */
  confirm: (token: string) =>
    request<PatreonStatus>('/confirm', 'POST', 'Could not finish the link. Try again in a moment.', { token }),

  setShowFlair: (showFlair: boolean) =>
    request<PatreonStatus>('', 'PATCH', 'Could not save the flair setting.', { showFlair }),

  unlink: () => request<PatreonStatus>('', 'DELETE', 'Could not unlink Patreon.'),

  /** The public Supporters wall. Needs no sign-in. */
  async getSupporters(): Promise<Supporter[]> {
    const failure = 'Could not load the Supporters wall.';
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/patreon/supporters`);
    } catch {
      throw new PatreonError(failure);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new PatreonError(payload.error || failure, payload.code ?? null);
    return payload.data as Supporter[];
  },
};
