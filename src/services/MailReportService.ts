import AuthService from './AuthService';
import { authHeaders, unwrap } from './authRequest';

/** One UTC day of mail, counted by each mail's current status. */
export interface MailReportDay {
  day: string;
  sent: number;
  delivered: number;
  delayed: number;
  hardBounced: number;
  softBounced: number;
  complained: number;
}

/** Amazon's limits for one rate, as fractions (0.05 is 5%). */
export interface MailRateLimits {
  alert: number;
  review: number;
  pause: number;
}

export interface MailRate {
  count: number;
  /** Null when no mail was sent in the window. */
  rate: number | null;
  limits: MailRateLimits;
}

/** The mail report: `GET /api/mail/report`. Days run newest first. */
export interface MailReport {
  days: MailReportDay[];
  rates: {
    windowDays: number;
    minVolume: number;
    volume: number;
    /** False under the volume floor. */
    measured: boolean;
    bounce: MailRate;
    complaint: MailRate;
  };
  /** Null until the hourly health job has read SES once. */
  ses: { enforcementStatus: string | null; sendingEnabled: boolean | null; checkedAt: string } | null;
  last24Hours: { sent: number; quota: number } | null;
}

export interface MailReportApi {
  fetchMailReport(days: number, signal?: AbortSignal): Promise<MailReport>;
}

/** The admin mail report route. Answers 403 to a moderator. */
class MailReportService implements MailReportApi {
  async fetchMailReport(days: number, signal?: AbortSignal): Promise<MailReport> {
    const response = await fetch(`${AuthService.API_URL}/mail/report?days=${days}`, { headers: authHeaders(), signal });
    return (await unwrap<{ data: MailReport }>(response, 'Failed to read the mail report')).data;
  }
}

export default new MailReportService();
