import { toast, type ToastOptions } from 'react-toastify';
import { describeError, showErrorDetails, type ErrorDetails, type ToastText } from './errorDetails';

/** A toast with a text link under its lines; it stays open on click so the link can be pressed. */
export function linkToast(
  message: string | readonly string[], linkLabel: string, onLink: () => void, options: ToastOptions = {},
  level: 'error' | 'warning' = 'error',
): void {
  const lines = typeof message === 'string' ? [message] : message;
  toast[level](
    <div className="flex flex-col items-start gap-1">
      {lines.map((line, i) => <span key={i} className="[overflow-wrap:anywhere]">{line}</span>)}
      <button type="button" className="text-meta underline" onClick={onLink}>
        {linkLabel}
      </button>
    </div>,
    { position: 'top-right', autoClose: 8000, closeOnClick: false, pauseOnHover: true, draggable: true, ...options },
  );
}

/** Toasts a caught error with a View Details link to its full text; `note` adds a toast-only line under the message. */
export function toastError(error: unknown, toastText: ToastText, note?: string): void {
  const described = describeError(error, toastText);
  // Fallback text the error's own message displaced still names what failed, so the details open with it.
  toastErrorDetails(typeof toastText === 'string' && toastText && described.message !== toastText
    ? { ...described, details: `${toastText}\n\n${described.details}` }
    : described, note);
}

/** Toasts an already described error with a View Details link to its full text. */
export function toastErrorDetails(entry: ErrorDetails, note?: string): void {
  linkToast(note ? [entry.message, note] : entry.message, 'View Details →', () => showErrorDetails(entry));
}
