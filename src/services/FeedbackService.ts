import AuthService from './AuthService';
import { collectDiagnostics } from '@/lib/bugDiagnostics';
import type {
  FeedbackCategory, FeedbackComment, FeedbackDetail, FeedbackDraft, FeedbackStatus, FeedbackThread,
  FeedbackType,
} from '@/types';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** A page of threads, with the match count before paging so a pager can be drawn. */
export interface FeedbackPage {
  threads: FeedbackThread[];
  total: number;
  /**
   * Set when a multi-status page could not be assembled in full because the server returned fewer rows
   * than asked for. The page shown is short, so the reader has to be told rather than left to assume it
   * is the whole of it.
   */
  truncated?: boolean;
}

/**
 * The server's own ordering, reproduced so separately-fetched lists can be merged back into one.
 *
 * @param sort - The sort asked of the server; anything but `votes` is newest first, its default
 * @returns A comparator over two threads
 */
const compareThreads = (sort?: string) => (a: FeedbackThread, b: FeedbackThread): number => {
  // Most-voted ties are broken by date, so equal-vote rows keep a stable, meaningful order.
  if (sort === 'votes' && a.votes !== b.votes) return b.votes - a.votes;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
};

/**
 * User-filed feedback: bug reports and suggestions, and the comment thread on each.
 *
 * The one channel running user→admin. Reading is open to any signed-in account on both branches; who may
 * write differs, and the server is the authority on that whatever this asks for.
 */
class FeedbackService {
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

  /**
   * File a bug report or a suggestion.
   *
   * Diagnostics are collected here so every caller sends the same block — and only for a bug, since a
   * suggestion is about the game rather than the machine it was written on. The server drops them from a
   * suggestion regardless; not sending them is what makes the promise true on this side too.
   */
  async file(draft: FeedbackDraft): Promise<FeedbackThread> {
    const response = await fetch(`${this.apiUrl}/feedback`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({
        ...draft,
        ...(draft.type === 'bug' ? { diagnostics: collectDiagnostics() } : {}),
      }),
    });

    const body = await this.unwrap<{ data: FeedbackThread }>(response, 'Failed to file this');
    return body.data;
  }

  /**
   * A page of threads from one branch.
   *
   * @param options - `scope: 'all'` asks for everyone's; omit for the caller's own
   */
  async list({ type, page = 1, limit = 20, status, category, scope, sort }: {
    type: FeedbackType;
    page?: number;
    limit?: number;
    status?: FeedbackStatus | FeedbackStatus[];
    category?: FeedbackCategory;
    scope?: 'all';
    sort?: string;
  }): Promise<FeedbackPage> {
    if (Array.isArray(status)) {
      return this.listAcrossStatuses({ type, page, limit, statuses: status, category, scope, sort });
    }

    const query = new URLSearchParams({ type, page: String(page), limit: String(limit) });
    if (status) query.set('status', status);
    if (category) query.set('category', category);
    if (scope) query.set('scope', scope);
    if (sort) query.set('sort', sort);

    const response = await fetch(`${this.apiUrl}/feedback?${query}`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: FeedbackThread[]; total: number }>(response, 'Failed to load these');

    return { threads: body.data, total: body.total };
  }

  /**
   * A page spanning several statuses at once, assembled from one request per status.
   *
   * The API takes a single status, so a filter like "everything not closed" has to be asked for as its
   * parts. The parts are disjoint — a thread sits in exactly one status — so the totals sum without
   * double counting, and each part comes back ordered by the same key. Taking the first `page * limit`
   * of every part therefore guarantees the requested page is somewhere in the merge: no row that
   * belongs on it can be sitting further down a list than that.
   *
   * @param options - As `list`, with the statuses to span in place of the one
   */
  private async listAcrossStatuses({ type, page, limit, statuses, category, scope, sort }: {
    type: FeedbackType;
    page: number;
    limit: number;
    statuses: FeedbackStatus[];
    category?: FeedbackCategory;
    scope?: 'all';
    sort?: string;
  }): Promise<FeedbackPage> {
    const reach = page * limit;
    const parts = await Promise.all(statuses.map((status) =>
      this.list({ type, page: 1, limit: reach, status, category, scope, sort })));

    const total = parts.reduce((sum, part) => sum + part.total, 0);
    // A part that came back shorter than both the reach and its own total means the server capped the
    // page size, so the merge is missing rows it should have had.
    const truncated = parts.some((part) => part.threads.length < Math.min(reach, part.total));

    const merged = parts.flatMap((part) => part.threads).sort(compareThreads(sort));
    return { threads: merged.slice((page - 1) * limit, page * limit), total, truncated };
  }

  /** One thread with its comments. Reading marks it seen for anyone it badges. */
  async fetchThread(id: string): Promise<FeedbackDetail> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: FeedbackThread; comments: FeedbackComment[] }>(response, 'Failed to load this');

    return { thread: body.data, comments: body.comments };
  }

  /** Add a comment to a thread. */
  async comment(id: string, body: string): Promise<FeedbackComment> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}/comments`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify({ body }),
    });

    const payload = await this.unwrap<{ data: FeedbackComment }>(response, 'Failed to post the comment');
    return payload.data;
  }

  /** Rewrite a comment. The server allows this to its author only, admin or not. */
  async editComment(id: string, commentId: string, body: string): Promise<FeedbackComment> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}/comments/${commentId}`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify({ body }),
    });

    const payload = await this.unwrap<{ data: FeedbackComment }>(response, 'Failed to save the comment');
    return payload.data;
  }

  /** Remove a comment — its author, or an admin moderating a thread. */
  async removeComment(id: string, commentId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}/comments/${commentId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to delete the comment');
  }

  /** Vote for a suggestion, or take the vote back. */
  async setVote(id: string, voted: boolean): Promise<FeedbackThread> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}/vote`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify({ voted }),
    });

    const body = await this.unwrap<{ data: FeedbackThread }>(response, 'Failed to record your vote');
    return body.data;
  }

  /**
   * Rewrite a report.
   *
   * Every field is optional and only what is passed is written. Who may change what is the server's
   * call — a bug's words are the team's to make useful, a suggestion's stay its author's, and the filing
   * is triage either way — so this sends what was asked for and surfaces a refusal verbatim.
   *
   * @param id - The thread
   * @param fields - `{ title, body, category, type }`, any subset. A type change must carry a category
   *   from the new type's own list.
   * @returns The thread as it now reads
   */
  async update(
    id: string,
    fields: { title?: string; body?: string; category?: FeedbackCategory; type?: FeedbackType }
  ): Promise<FeedbackThread> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify(fields),
    });

    const body = await this.unwrap<{ data: FeedbackThread }>(response, 'Failed to save the changes');
    return body.data;
  }

  /** Move a thread through triage (admin only). */
  async setStatus(id: string, status: FeedbackStatus): Promise<FeedbackThread> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}/status`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify({ status }),
    });

    const body = await this.unwrap<{ data: FeedbackThread }>(response, 'Failed to update the status');
    return body.data;
  }

  /** Close a thread to further replies, or reopen it (admin only). */
  async setLocked(id: string, locked: boolean): Promise<FeedbackThread> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}/lock`, {
      method: 'PUT',
      headers: this.authHeaders(true),
      body: JSON.stringify({ locked }),
    });

    const body = await this.unwrap<{ data: FeedbackThread }>(response, 'Failed to lock the thread');
    return body.data;
  }

  /** Delete a thread and everything on it (admin only). */
  async remove(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/feedback/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    await this.unwrap(response, 'Failed to delete this');
  }

  /** How many of the caller's threads have something new in them, both branches together. */
  async fetchUnreadCount(): Promise<number> {
    const response = await fetch(`${this.apiUrl}/feedback/unread-count`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ unread: number }>(response, 'Failed to read the feedback count');

    return body.unread || 0;
  }
}

export default new FeedbackService();
