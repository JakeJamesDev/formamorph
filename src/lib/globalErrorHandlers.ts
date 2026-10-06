import { describeError } from './errorDetails';
import { toastError } from './linkToast';

const REPEAT_WINDOW_MS = 10_000;
const SESSION_TOAST_CAP = 5;
const FALLBACK_MESSAGE = 'Something went wrong.';

const RESIZE_OBSERVER_NOTICE = /^ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;
const EXTENSION_URL = /(chrome|moz|safari(-web)?)-extension:\/\//;
// The browser hides the message of a script from another origin behind this text.
const OPAQUE_SCRIPT_ERROR = 'Script error.';

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;

function isIgnored(error: unknown, message: string, filename: string): boolean {
  if (field(error, 'name') === 'AbortError') return true;
  if (message === OPAQUE_SCRIPT_ERROR || RESIZE_OBSERVER_NOTICE.test(message)) return true;
  const stack = field(error, 'stack');
  return EXTENSION_URL.test(filename) || (typeof stack === 'string' && EXTENSION_URL.test(stack));
}

/**
 * Logs every unhandled rejection and window error. A toast with a View Details link follows, except for noise
 * the player cannot act on, a repeat of the same message inside the repeat window, and any error past the
 * session cap. Returns the function that removes the listeners.
 */
export function installGlobalErrorHandlers(): () => void {
  const lastToastAt = new Map<string, number>();
  let toasted = 0;

  const handle = (label: string, error: unknown, filename = '') => {
    const { message } = describeError(error, FALLBACK_MESSAGE);
    if (isIgnored(error, message, filename)) return;
    console.error(label, error);
    if (toasted >= SESSION_TOAST_CAP) return;
    const now = Date.now();
    const last = lastToastAt.get(message);
    if (last !== undefined && now - last < REPEAT_WINDOW_MS) return;
    lastToastAt.set(message, now);
    toasted += 1;
    toastError(error, FALLBACK_MESSAGE);
  };

  const onRejection = (event: PromiseRejectionEvent) => handle('Unhandled rejection:', event.reason);
  const onError = (event: ErrorEvent) => handle('Unhandled error:', event.error ?? event.message, event.filename);

  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('error', onError);
  return () => {
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('error', onError);
  };
}
