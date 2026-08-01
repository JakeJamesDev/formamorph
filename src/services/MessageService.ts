import AuthService from './AuthService';
import type { ComposeMessageInput, EditMessageInput, InboxMessage, SentMessage } from '@/types';

/** A paged inbox fetch. `total` is everything visible, so the caller can tell the list was truncated. */
export interface InboxResult {
  messages: InboxMessage[];
  total: number;
  unread: number;
}

/** A paged sent-list fetch. */
export interface SentResult {
  messages: SentMessage[];
  total: number;
}

/** Server error envelope: this API answers with `error`, older handlers here read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/**
 * Admin messages: the inbox a user reads in their profile dialog, and the send/recall side an admin
 * drives from Manage Users. Talks to the same community server as `AuthService`, whose token it borrows.
 *
 * Default-exported as one shared instance, matching `AuthService`.
 */
class MessageService {
  private get apiUrl() {
    return AuthService.API_URL;
  }

  private authHeaders(withBody = false): HeadersInit {
    const headers: Record<string, string> = { Authorization: `Bearer ${AuthService.token}` };
    if (withBody) headers['Content-Type'] = 'application/json';
    return headers;
  }

  /** Unwrap a response, raising the server's own error text so callers can surface it verbatim. */
  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      throw new Error(body.error || body.message || fallback);
    }
    return (await response.json()) as T;
  }

  /** The current user's inbox, newest first. */
  async fetchInbox(limit = 50): Promise<InboxResult> {
    const response = await fetch(`${this.apiUrl}/messages?limit=${limit}`, {
      headers: this.authHeaders(),
    });

    const body = await this.unwrap<{ data: InboxMessage[]; total: number; unread: number }>(
      response, 'Failed to load messages',
    );

    return { messages: body.data, total: body.total, unread: body.unread };
  }

  /**
   * The current user's unread count, and how loud the loudest of them is.
   *
   * Both in one call because the badge is colored by the severity and sized by the count: asking
   * separately would leave a moment where the number and the color disagree.
   *
   * @returns The count, and the top severity — null when nothing is unread
   */
  async fetchUnreadCount(): Promise<{ unread: number; topSeverity: string | null }> {
    const response = await fetch(`${this.apiUrl}/messages/unread-count`, {
      headers: this.authHeaders(),
    });

    const body = await this.unwrap<{ unread: number; topSeverity?: string | null }>(
      response,
      'Failed to load unread count'
    );

    // Absent from a server that predates the severity: a count with no color is the old behavior.
    return { unread: body.unread, topSeverity: body.topSeverity ?? null };
  }

  /** Mark a message read. Idempotent — the server keeps the first timestamp. */
  async markRead(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/messages/${id}/read`, {
      method: 'POST',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to mark the message read');
  }

  /** Clear a message from the current user's inbox. The server keeps the row for the admin's receipt. */
  async dismiss(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/messages/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to dismiss the message');
  }

  /** Send to one user, several users, or everyone. Returns one record per message created. */
  async send(input: ComposeMessageInput): Promise<SentMessage[]> {
    const response = await fetch(`${this.apiUrl}/messages`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify(input),
    });

    const body = await this.unwrap<{ data: SentMessage[] }>(response, 'Failed to send the message');
    return body.data;
  }

  /**
   * The admin sent list. `userId` narrows to one user's direct history; `audience` picks a half
   * (`direct` or `broadcast`), which is how the Users and Broadcasts tabs stay separate.
   */
  async fetchSent({ page = 1, limit = 20, userId, audience }: {
    page?: number;
    limit?: number;
    userId?: string;
    audience?: 'direct' | 'broadcast';
  } = {}): Promise<SentResult> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (userId) query.set('userId', userId);
    if (audience) query.set('audience', audience);

    const response = await fetch(`${this.apiUrl}/messages/sent?${query}`, {
      headers: this.authHeaders(),
    });

    const body = await this.unwrap<{ data: SentMessage[]; total: number }>(
      response, 'Failed to load sent messages',
    );

    return { messages: body.data, total: body.total };
  }

  /**
   * Rewrite a sent message in place. `renotify` makes it land as a fresh delivery — every reader is
   * badged again, receipts restart from zero, and anyone who had dismissed it gets it back.
   */
  async edit(id: string, input: EditMessageInput): Promise<SentMessage> {
    const response = await fetch(`${this.apiUrl}/messages/sent/${id}`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify(input),
    });

    const body = await this.unwrap<{ data: SentMessage }>(response, 'Failed to save the message');
    return body.data;
  }

  /** Recall a sent message: hidden from its readers, kept on the sent list. */
  async recall(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/messages/sent/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to recall the message');
  }
}

export default new MessageService();
