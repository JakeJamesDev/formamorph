import type { MailReport, MailReportApi } from '@/services/MailReportService';

const DAY_MS = 86_400_000;
const WAVE = [62, 70, 55, 81, 90, 74, 66, 58, 77, 95, 88, 64, 71, 83, 79, 69, 60, 92, 85, 73, 67, 80, 97, 76, 63, 72, 89, 68, 78, 84];

/**
 * DEV: an in-memory stand-in for the mail report route
 * (`#dev?modal=adminPanel&tab=mail&fixture=mail`, or `fixture=mailReview` for an account under review).
 *
 * Every figure is a placeholder to make the tab render; none is a real count.
 */
export function createDevMailApi(underReview: boolean): MailReportApi {
  return {
    fetchMailReport: async (count) => {
      const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
      const days: MailReport['days'] = Array.from({ length: count }, (_, index) => {
        const sent = WAVE[(WAVE.length - count + index + WAVE.length) % WAVE.length];
        const hardBounced = underReview ? Math.round(sent * 0.04) : index % 7 === 0 ? 1 : 0;
        const complained = underReview && index % 3 === 0 ? 1 : 0;
        const delayed = index % 5 === 0 ? 1 : 0;
        const softBounced = index % 9 === 0 ? 1 : 0;
        return {
          day: new Date(today - index * DAY_MS).toISOString().slice(0, 10),
          sent,
          delivered: sent - hardBounced - complained - delayed - softBounced,
          delayed,
          hardBounced,
          softBounced,
          complained,
        };
      });

      const volume = 540;
      const hard = underReview ? 22 : 3;
      const complaints = underReview ? 1 : 0;
      return {
        days,
        rates: {
          windowDays: 7,
          minVolume: 200,
          volume,
          measured: true,
          bounce: { count: hard, rate: hard / volume, limits: { alert: 0.025, review: 0.05, pause: 0.1 } },
          complaint: { count: complaints, rate: complaints / volume, limits: { alert: 0.0005, review: 0.001, pause: 0.005 } },
        },
        ses: {
          enforcementStatus: underReview ? 'PROBATION' : 'HEALTHY',
          sendingEnabled: true,
          checkedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        },
        last24Hours: { sent: 83, quota: 50_000 },
      };
    },
  };
}
