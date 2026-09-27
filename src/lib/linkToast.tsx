import { toast } from 'react-toastify';
import { describeError, showErrorDetails, type ToastText } from './errorDetails';

/** An error toast with a text link under its lines; it stays open on click so the link can be pressed. */
export function linkToast(message: string | readonly string[], linkLabel: string, onLink: () => void): void {
  const lines = typeof message === 'string' ? [message] : message;
  toast.error(
    <div className="flex flex-col items-start gap-1">
      {lines.map((line, i) => <span key={i}>{line}</span>)}
      <button type="button" className="text-meta underline" onClick={onLink}>
        {linkLabel}
      </button>
    </div>,
    { position: 'top-right', autoClose: 8000, closeOnClick: false, pauseOnHover: true, draggable: true },
  );
}

/** Toasts a caught error with a View Details link to its full text; `note` adds a toast-only line under the message. */
export function toastError(error: unknown, toastText: ToastText, note?: string): void {
  const entry = describeError(error, toastText);
  linkToast(note ? [entry.message, note] : entry.message, 'View Details →', () => showErrorDetails(entry));
}
