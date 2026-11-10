import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { EmailNoticeReason } from '@/services/AuthService';

const CAUSE: Record<EmailNoticeReason, string> = {
  bounce: 'Email to this address bounced, so no more email goes to it.',
  complaint: 'This mailbox marked an email from Formamorph as spam, so no more email goes to it.',
  unknown: 'Email to this address bounced or was marked as spam, so no more email goes to it.',
};

/** The website's Questions board, which staff read. */
export const QUESTIONS_BOARD_PATH = '/feedback?board=questions';

/** Builds one link in the notice from its text, so each surface supplies its own control. */
type LinkSlot = (text: string) => ReactNode;

interface EmailMarkerLinesProps {
  reason: EmailNoticeReason;
  /** The link to the Questions board, which staff read. */
  feedback: LinkSlot;
  /** The link to the account page, for a surface that has no address field of its own. */
  account?: LinkSlot;
}

/** The notice's sentences, for a page that supplies its own heading. */
export function EmailMarkerLines({ reason, feedback, account }: EmailMarkerLinesProps) {
  return (
    <>
      <p>{CAUSE[reason]} Password reset won&rsquo;t work until you verify an address.</p>
      <p>
        {account ? <>Save a different address on {account('your account')} to fix this.</> : 'Save a different address to fix this.'}
        {' '}If this address is correct, {feedback('ask staff in Feedback')} to turn email back on.
      </p>
    </>
  );
}

/** The marked-address callout in an account's email section. */
export function EmailMarkerNotice(props: EmailMarkerLinesProps) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
      <div className="space-y-1 text-label text-muted-foreground">
        <p className="font-bold text-destructive">Email Stopped</p>
        <EmailMarkerLines {...props} />
      </div>
    </div>
  );
}
