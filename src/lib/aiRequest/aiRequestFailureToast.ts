import { isLikelyConnectionError } from '@/lib/connectionError';
import { linkToast, toastError } from '@/lib/linkToast';
import { hostedStateCopy } from '@/lib/hostedAi/hostedCopy';
import { AiStreamError } from './aiStream';

/** Toasts a failed AI request: the connection guide for an unreachable server, Error Details for the rest. */
export function toastAiRequestFailure(error: unknown, openConnectionGuide: () => void): void {
  const hosted = error instanceof AiStreamError ? error.hosted : undefined;
  if (hosted) {
    // A preset state's reason, else the server's own message.
    const headline = (hosted.presetState && hostedStateCopy(hosted.presetState)?.reason) || hosted.message || 'Formamorph AI refused the request';
    toastError(error, { headline });
  } else if (isLikelyConnectionError(error)) linkToast("Couldn't reach your AI server.", 'Fix connection →', openConnectionGuide);
  else toastError(error, { headline: 'Failed to process AI request' });
}
