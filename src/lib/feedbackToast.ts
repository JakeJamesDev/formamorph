import { toast } from 'react-toastify';
import { toastError } from '@/lib/linkToast';
import type { FeedbackNotify } from '@/lib/feedbackCapabilities';

/** The app's feedback notify: a caught error keeps its View Details link. */
export const toastFeedbackNotify: FeedbackNotify = (message, kind, error) => {
  if (kind === 'success') toast.success(message);
  else if (error !== undefined) toastError(error, message);
  else toast.error(message);
};
