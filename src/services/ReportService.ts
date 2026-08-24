import AuthService from './AuthService';
import { serverSupportsReports, type ReportGroup } from '@/lib/contentReports';

/** Server error envelope: this API answers with `error`, older handlers elsewhere read `message`. */
interface ErrorBody {
  error?: string;
  message?: string;
}

/** The caps and lists this server will accept, and — by existing at all — that it takes reports. */
export interface ReportMeta {
  categories: string[];
  targetKinds: string[];
  outcomes: string[];
  detailsMax: number;
  noteMax: number;
}

/** What a reporter is told about their own report, and nothing about anyone else's. */
export interface FiledReport {
  id: string;
  status: string;
  category: string;
  createdAt: string;
}

/** Thrown when a reporter already has an open report on this target — a state, not a failure. */
export class AlreadyReportedError extends Error {}

/**
 * Content Reports: the room telling staff about something, and staff closing the loop.
 *
 * The one channel here that has to survive its own absence. The community server is a separate live
 * deployment that may not have this feature yet, so `fetchMeta` answering null is a normal state every
 * caller handles by hiding its controls — not an error to report.
 */
class ReportService {
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
   * What this server accepts, or null when it has never heard of reports — and `undefined` when the
   * question could not be answered at all.
   *
   * Absence-detected rather than version-gated: a deploy that predates the feature 404s here, and every
   * surface reading that hides itself. The third answer matters as much as the other two, because a
   * caller that caches "no" would otherwise cache a stale token's 401 or a dropped connection and keep
   * every report control off screen for the rest of the session — including after a fresh sign-in.
   *
   * Never throws: neither "no reports here" nor "could not tell" is an error anybody can act on.
   */
  async fetchMeta(): Promise<ReportMeta | null | undefined> {
    try {
      const response = await fetch(`${this.apiUrl}/reports/meta`, { headers: this.authHeaders() });
      // 404 is the feature being absent, which is a real answer. Anything else that failed — 401 on a
      // retired token, a 5xx, a proxy hiccup — is the question going unanswered.
      if (response.status === 404) return null;
      if (!response.ok) return undefined;

      const body = (await response.json()) as { data?: ReportMeta };

      return serverSupportsReports(body.data) ? (body.data as ReportMeta) : null;
    } catch {
      return undefined;
    }
  }

  /**
   * File a report.
   *
   * A still-open earlier report by the same reporter comes back as `AlreadyReportedError`, which the
   * dialog says plainly rather than treating as a failure.
   */
  async file(input: {
    targetKind: string;
    targetId: string;
    category: string;
    details?: string;
  }): Promise<FiledReport> {
    const response = await fetch(`${this.apiUrl}/reports`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify(input),
    });

    if (response.status === 409) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody;
      throw new AlreadyReportedError(body.error || 'You have already reported this.');
    }

    const body = await this.unwrap<{ data: FiledReport }>(response, 'Failed to send this report');

    return body.data;
  }

  /** The open queue, one entry per reported target (staff only). */
  async fetchQueue(): Promise<ReportGroup[]> {
    const response = await fetch(`${this.apiUrl}/reports`, { headers: this.authHeaders() });
    const body = await this.unwrap<{ data: ReportGroup[] }>(response, 'Failed to load the report queue');

    return body.data || [];
  }

  /**
   * How many targets have an open report on them.
   *
   * Zero rather than an error against a server without the feature, for `fetchMeta`'s reason: the badge
   * is drawn on every main-menu render, and a staff member on an older server should see no badge rather
   * than a console full of failures.
   */
  async fetchOpenCount(): Promise<number> {
    try {
      const response = await fetch(`${this.apiUrl}/reports/open-count`, { headers: this.authHeaders() });
      if (!response.ok) return 0;

      const body = (await response.json()) as { open?: number };

      return body.open || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Close every open report on one target, and notify each reporter.
   *
   * Per target rather than per report: staff judge the content once, so everyone who reported it gets
   * that answer, and a pile-on is one decision rather than N.
   */
  async resolve(input: {
    targetKind: string;
    targetId: string;
    outcome: string;
    note?: string;
  }): Promise<{ resolved: number; notified: number }> {
    const response = await fetch(`${this.apiUrl}/reports/resolve`, {
      method: 'POST',
      headers: this.authHeaders(true),
      body: JSON.stringify(input),
    });

    const body = await this.unwrap<{ data: { resolved: number; notified: number } }>(
      response,
      'Failed to resolve these reports',
    );

    return body.data;
  }
}

export default new ReportService();
