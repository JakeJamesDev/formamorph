import AuthService from './AuthService';
import { collectDiagnostics } from '@/lib/bugDiagnostics';
import type { BugComment, BugDraft, BugReport, BugStatus, BugThread } from '@/types';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** A page of reports, with the match count before paging so a pager can be drawn. */
export interface BugPage {
  reports: BugReport[];
  total: number;
}

/**
 * User-filed bug reports and the comment thread on each.
 *
 * The one channel running user→admin. A reporter sees only their own reports; an admin asks for the whole
 * queue explicitly with `scope: 'all'`, which the server enforces regardless of what is requested here.
 */
class BugService {
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

  /** File a report. Diagnostics are collected here so every caller sends the same block. */
  async file(draft: BugDraft): Promise<BugReport> {
    const response = await fetch(`${this.apiUrl}/bugs`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ ...draft, diagnostics: collectDiagnostics() }),
    });

    const body = await this.unwrap<{ data: BugReport }>(response, 'Failed to file the report');
    return body.data;
  }

  /**
   * A page of reports.
   *
   * @param options - `scope: 'all'` asks for everyone's (admin only); omit for the caller's own
   */
  async list({ page = 1, limit = 20, status, scope }: {
    page?: number;
    limit?: number;
    status?: BugStatus;
    scope?: 'all';
  } = {}): Promise<BugPage> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) query.set('status', status);
    if (scope) query.set('scope', scope);

    const response = await fetch(`${this.apiUrl}/bugs?${query}`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: BugReport[]; total: number }>(response, 'Failed to load reports');

    return { reports: body.data, total: body.total };
  }

  /** One report with its thread. Reading it marks the thread seen, clearing its share of the badge. */
  async fetchThread(id: string): Promise<BugThread> {
    const response = await fetch(`${this.apiUrl}/bugs/${id}`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: BugReport; comments: BugComment[] }>(response, 'Failed to load the report');

    return { report: body.data, comments: body.comments };
  }

  /** Add a comment to a thread. */
  async comment(id: string, body: string): Promise<BugComment> {
    const response = await fetch(`${this.apiUrl}/bugs/${id}/comments`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ body }),
    });

    const payload = await this.unwrap<{ data: BugComment }>(response, 'Failed to post the comment');
    return payload.data;
  }

  /** Rewrite a comment. The server allows this to its author only, admin or not. */
  async editComment(id: string, commentId: string, body: string): Promise<BugComment> {
    const response = await fetch(`${this.apiUrl}/bugs/${id}/comments/${commentId}`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify({ body }),
    });

    const payload = await this.unwrap<{ data: BugComment }>(response, 'Failed to save the comment');
    return payload.data;
  }

  /** Remove a comment. Its author only, same as editing. */
  async removeComment(id: string, commentId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/bugs/${id}/comments/${commentId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to delete the comment');
  }

  /** Move a report through triage (admin only). */
  async setStatus(id: string, status: BugStatus): Promise<BugReport> {
    const response = await fetch(`${this.apiUrl}/bugs/${id}/status`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify({ status }),
    });

    const body = await this.unwrap<{ data: BugReport }>(response, 'Failed to update the status');
    return body.data;
  }

  /** Delete a report and its thread (admin only). */
  async remove(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/bugs/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to delete the report');
  }

  /** How many of the caller's threads have something new in them. */
  async fetchUnreadCount(): Promise<number> {
    const response = await fetch(`${this.apiUrl}/bugs/unread-count`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ unread: number }>(response, 'Failed to read the bug count');

    return body.unread || 0;
  }
}

export default new BugService();
