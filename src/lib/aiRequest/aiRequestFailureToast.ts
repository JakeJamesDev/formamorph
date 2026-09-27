import { isLikelyConnectionError } from '@/lib/connectionError';
import { linkToast, toastError } from '@/lib/linkToast';

/** Toasts a failed AI request: the connection guide for an unreachable server, Error Details for the rest. */
export function toastAiRequestFailure(error: unknown, openConnectionGuide: () => void): void {
  if (isLikelyConnectionError(error)) linkToast("Couldn't reach your AI server.", 'Fix connection →', openConnectionGuide);
  else toastError(error, { headline: 'Failed to process AI request' });
}
