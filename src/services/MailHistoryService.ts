import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';
import type { EmailMarker } from '@/types';

export type MailKind = 'verify' | 'reset' | 'alert';
export type MailStatus = 'sent' | 'delayed' | 'delivered' | 'bounced' | 'complained';

/** One mail to an account. `bounceType` is present on a bounced mail only. */
export interface MailHistoryRow {
  kind: MailKind;
  status: MailStatus;
  sentAt: string;
  statusAt: string;
  bounceType?: 'hard' | 'soft' | null;
}

/** `GET /api/users/:id/mail-history`. Mails run newest first. The route sends no address. */
export interface MailHistory {
  emailMarker: EmailMarker | null;
  emailMarkedAt: string | null;
  mails: MailHistoryRow[];
}

export interface MailHistoryApi {
  fetchMailHistory(userId: string, signal?: AbortSignal): Promise<MailHistory>;
  /** Resolves to whether a marker was removed. Rejects with the server's message when SES refuses. */
  clearEmailMarker(userId: string, signal?: AbortSignal): Promise<boolean>;
}

/** The staff routes for one account's mail history and address marker. */
class MailHistoryService implements MailHistoryApi {
  async fetchMailHistory(userId: string, signal?: AbortSignal): Promise<MailHistory> {
    const response = await fetch(`${AuthService.API_URL}/users/${encodeURIComponent(userId)}/mail-history`, { headers: authHeaders(), signal });
    return (await unwrap<{ data: MailHistory }>(response, 'Failed to read the mail history')).data;
  }

  async clearEmailMarker(userId: string, signal?: AbortSignal): Promise<boolean> {
    const response = await fetch(`${AuthService.API_URL}/users/${encodeURIComponent(userId)}/email-marker`, { method: 'DELETE', headers: authHeaders(), signal });
    return (await unwrap<{ data: { cleared: boolean } }>(response, 'Failed to clear the bounce')).data.cleared;
  }
}

export default new MailHistoryService();
