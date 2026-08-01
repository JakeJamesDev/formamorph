import AuthService from './AuthService';
import type { AuditAction, AuditEntry } from '@/types';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** A page of entries, with the match count before paging so a pager can be drawn. */
export interface AuditPage {
  entries: AuditEntry[];
  total: number;
}

/**
 * The admin audit log: what was done to accounts and to published work.
 *
 * Read-only by design — entries are written by the server from inside the actions they record, and there
 * is no route here to add, change or remove one.
 */
class AuditService {
  private get apiUrl() {
    return AuthService.API_URL;
  }

  private authHeaders(): HeadersInit {
    return { Authorization: `Bearer ${AuthService.token}` };
  }

  private async unwrap<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      throw new Error(body.error || body.message || fallback);
    }
    return (await response.json()) as T;
  }

  /**
   * A page of entries, newest first.
   *
   * @param options - `action` narrows to one kind of event; `search` matches the actor, the account it
   *   was done to, or the name of what it was done to
   */
  async list({ page = 1, limit = 20, action, search }: {
    page?: number;
    limit?: number;
    action?: AuditAction;
    search?: string;
  } = {}): Promise<AuditPage> {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action) query.set('action', action);
    if (search) query.set('search', search);

    const response = await fetch(`${this.apiUrl}/audit?${query}`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: AuditEntry[]; total: number }>(response, 'Failed to load the log');

    return { entries: body.data, total: body.total };
  }
}

export default new AuditService();
