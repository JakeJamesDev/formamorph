import { toast } from 'react-toastify';
import { DetailedError, showErrorDetails } from './errorDetails';

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

/** Toasts an error's message; a DetailedError adds a View Details link to its full text. */
export function toastError(error: unknown, fallback: string): void {
  const message = (error as Error | undefined)?.message || fallback;
  if (!(error instanceof DetailedError)) {
    toast.error(message);
    return;
  }
  const { details } = error;
  linkToast(message, 'View Details →', () => showErrorDetails({ message, details }));
}
