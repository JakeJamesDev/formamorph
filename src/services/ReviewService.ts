import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';
import { readFailure, responseError } from './responseError';
import type { CatalogKind } from '@/lib/catalogKinds';
import type { PendingUpdate, ReviewItemType } from '@/lib/listingModeration';

/** Whether this server holds new listings for review right now. */
export interface ReviewMeta {
  enabled: boolean;
}


/** The author a review answer names. `role` is null for an ordinary account. */
export interface ReviewAuthor {
  id: string;
  username: string | null;
  avatarUrl?: string | null;
  role?: string | null;
}

/** One waiting item, as the queue serves it. */
export interface ReviewQueueItem {
  id: string;
  kind: CatalogKind;
  name: string;
  type: ReviewItemType;
  author: ReviewAuthor | null;
  contest: { id: string; title: string } | null;
  queuedAt: string;
  createdAt: string;
  /** The quarantine deadline, null unless the listing is quarantined. */
  quarantineExpiresAt?: string | null;
  /** On an update: what it changes. */
  pendingUpdate?: PendingUpdate;
}

/** What a rejection answers with: who to write to, and the quarantine the listing is in now. */
export interface ReviewRejection {
  id: string;
  author: ReviewAuthor | null;
  quarantinedAt?: string | null;
  quarantineExpiresAt?: string | null;
  quarantineExtended?: boolean;
}

/** Thrown on a `409`: the item is no longer waiting, or its approval must wait. Carries the server's text. */
export class ReviewConflictError extends Error {}

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

  /** The waiting items in the server's order (staff only). */
  async fetchQueue(signal?: AbortSignal): Promise<ReviewQueueItem[]> {
    const response = await fetch(`${this.apiUrl}/reviews`, { headers: authHeaders(), signal });
    const body = await unwrap<{ data?: ReviewQueueItem[] }>(response, 'Failed to load the review queue');

    return body.data ?? [];
  }

  /** How many items wait, 0 when the server has no review or the read fails. Never throws. */
  async fetchCount(): Promise<number> {
    try {
      const response = await fetch(`${this.apiUrl}/reviews/count`, { headers: authHeaders() });
      if (!response.ok) return 0;

      const body = (await response.json()) as { data?: { count?: unknown } };

      return typeof body.data?.count === 'number' ? body.data.count : 0;
    } catch {
      return 0;
    }
  }

  /** The waiting content file, as the author sent it. The route wraps it in the listing row. */
  async fetchContent(id: string): Promise<unknown> {
    const response = await fetch(`${this.apiUrl}/reviews/${id}/content`, { headers: authHeaders() });
    const body = await unwrap<{ data?: { contentData?: unknown } }>(response, 'Failed to download the content');

    if (body.data?.contentData === undefined) throw new Error('The server sent no content');

    return body.data.contentData;
  }

  /** Put a waiting item live. Throws {@link ReviewConflictError} on a `409`. */
  async approve(id: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/reviews/${id}/approve`, {
      method: 'POST',
      headers: authHeaders(true),
    });

    await this.throwUnlessOk(response, 'Failed to approve this');
  }

  /**
   * Reject a waiting item. `days` sets the quarantine of a new listing; a resubmission keeps its deadline,
   * so it sends none. Throws {@link ReviewConflictError} on a `409`.
   */
  async reject(id: string, days?: number): Promise<ReviewRejection> {
    const response = await fetch(`${this.apiUrl}/reviews/${id}/reject`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(days === undefined ? {} : { days }),
    });

    await this.throwUnlessOk(response, 'Failed to reject this');
    const body = (await response.json().catch(() => ({}))) as { data?: ReviewRejection };

    return body.data ?? { id, author: null };
  }

  private async throwUnlessOk(response: Response, fallback: string): Promise<void> {
    if (response.status === 409) {
      const { message } = await readFailure(response, 'This is no longer waiting for review', ['error']);
      throw new ReviewConflictError(message);
    }
    if (!response.ok) throw await responseError(response, fallback);
  }
}

export default new ReviewService();
