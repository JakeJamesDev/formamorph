import { isLikelyConnectionError } from '@/lib/connectionError';
import { linkToast, toastError } from '@/lib/linkToast';

/** Which prompt a failed request was for and which endpoint it went to, when the error carries them. */
function failedRequestOf(error: unknown): { prompt: string; endpoint: string } | null {
  const { prompt, endpoint } = (error ?? {}) as { prompt?: unknown; endpoint?: unknown };
  if (typeof prompt !== 'string' || !prompt) return null;
  return { prompt, endpoint: typeof endpoint === 'string' ? endpoint : '' };
}

/** Toasts a failed AI request: the connection guide for an unreachable server, Error Details for the rest. The
 *  headline names the prompt and the endpoint when the error carries them. */
export function toastAiRequestFailure(error: unknown, openConnectionGuide: () => void): void {
  const failed = failedRequestOf(error);
  const on = failed?.endpoint ? ` (${failed.endpoint})` : '';
  if (isLikelyConnectionError(error)) {
    linkToast(failed ? `Couldn't reach your AI server for ${failed.prompt}${on}.` : "Couldn't reach your AI server.", 'Fix connection →', openConnectionGuide);
  } else toastError(error, { headline: failed ? `${failed.prompt} failed${on}` : 'Failed to process AI request' });
}
