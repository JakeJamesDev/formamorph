import { useSyncExternalStore } from 'react';
import { FeedbackDialog } from '@/components/menu/FeedbackDialog';
import { closeFeedback, getFeedbackState, subscribeFeedback } from '@/lib/feedbackOpener';

/** The Feedback dialog that Error Details and the help window open; mounted once, beside the toast container, so every view shares it. */
export function FeedbackHost() {
  const { open, type, fill, opener } = useSyncExternalStore(subscribeFeedback, getFeedbackState);
  return (
    <FeedbackDialog
      open={open}
      onOpenChange={(next) => { if (!next) closeFeedback(); }}
      initialType={type}
      initialTitle={fill?.title}
      initialBody={fill?.body}
      returnFocus={opener}
    />
  );
}
