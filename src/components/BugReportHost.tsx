import { useSyncExternalStore } from 'react';
import { FeedbackDialog } from '@/components/menu/FeedbackDialog';
import { closeBugReport, getBugReportState, subscribeBugReport } from '@/lib/bugReportStore';

/** The bug report Error Details opens; mounted once, beside the toast container, so every view shares it. */
export function BugReportHost() {
  const { open, fill } = useSyncExternalStore(subscribeBugReport, getBugReportState);
  return (
    <FeedbackDialog
      open={open}
      onOpenChange={(next) => { if (!next) closeBugReport(); }}
      initialTitle={fill?.title}
      initialBody={fill?.body}
    />
  );
}
