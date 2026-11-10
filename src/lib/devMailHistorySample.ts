import type { MailHistory, MailHistoryApi } from '@/services/MailHistoryService';

const AGO = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/** The `tab=` values of the `mailHistory` dev pane. */
export const DEV_MAIL_HISTORY_STATES = ['marked', 'unmarked', 'empty', 'failed'] as const;
export type DevMailHistoryState = (typeof DEV_MAIL_HISTORY_STATES)[number];

const MAILS: MailHistory['mails'] = [
  { kind: 'reset', status: 'bounced', bounceType: 'hard', sentAt: AGO(30), statusAt: AGO(30) },
  { kind: 'verify', status: 'delivered', sentAt: AGO(300), statusAt: AGO(300) },
  { kind: 'verify', status: 'bounced', bounceType: 'soft', sentAt: AGO(700), statusAt: AGO(699) },
  { kind: 'alert', status: 'complained', sentAt: AGO(900), statusAt: AGO(898) },
  { kind: 'verify', status: 'delayed', sentAt: AGO(1200), statusAt: AGO(1200) },
];

/** DEV: canned mail history for `#dev?modal=mailHistory&tab=marked|unmarked|empty|failed`. Placeholders only. */
export function createDevMailHistoryApi(state: DevMailHistoryState): MailHistoryApi {
  return {
    fetchMailHistory: async () => {
      if (state === 'failed') throw new Error('The server did not answer');
      if (state === 'empty') return { emailMarker: null, emailMarkedAt: null, mails: [] };
      if (state === 'unmarked') return { emailMarker: null, emailMarkedAt: null, mails: MAILS.slice(1, 3) };
      return { emailMarker: 'bounce', emailMarkedAt: AGO(30), mails: MAILS };
    },
    clearEmailMarker: async () => true,
  };
}
