import { toast } from 'react-toastify';
import { describeError, showErrorDetails, type ToastText } from './errorDetails';

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

/** Toasts a caught error with a View Details link to its full text. */
export function toastError(error: unknown, toastText: ToastText): void {
  const entry = describeError(error, toastText);
  linkToast(entry.message, 'View Details →', () => showErrorDetails(entry));
}
