import { toast } from 'react-toastify';
import { describeError, showErrorDetails } from './errorDetails';

/** An error toast with a text link under its message; it stays open on click so the link can be pressed. */
export function linkToast(message: string, linkLabel: string, onLink: () => void): void {
  toast.error(
    <div className="flex flex-col items-start gap-1">
      <span>{message}</span>
      <button type="button" className="text-meta underline" onClick={onLink}>
        {linkLabel}
      </button>
    </div>,
    { position: 'top-right', autoClose: 8000, closeOnClick: false, pauseOnHover: true, draggable: true },
  );
}

/**
 * Toasts a caught error with a View Details link. A string is the fallback, shown when the error has
 * no message; `{ headline }` is always shown, and the error's own message moves into the details.
 */
export function toastError(error: unknown, text: string | { headline: string }): void {
  const entry = typeof text === 'string' ? describeError(error, text) : describeError(error, text.headline, text.headline);
  linkToast(entry.message, 'View Details →', () => showErrorDetails(entry));
}
