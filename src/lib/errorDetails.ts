/** An error whose message fits in a toast, plus the full text a user can copy when asking for help. */
export class DetailedError extends Error {
  details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = 'DetailedError';
    this.details = details;
  }
}

export interface ErrorDetails {
  message: string;
  details: string;
}

interface ErrorDetailsState {
  open: boolean;
  // Kept after close so the dialog's exit animation still has its text.
  entry: ErrorDetails | null;
}

let state: ErrorDetailsState = { open: false, entry: null };
const listeners = new Set<() => void>();
const publish = (next: ErrorDetailsState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Opens the Error Details dialog on this error. */
export function showErrorDetails(entry: ErrorDetails): void {
  publish({ open: true, entry });
}

export function closeErrorDetails(): void {
  publish({ ...state, open: false });
}

export function subscribeErrorDetails(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getErrorDetailsState(): ErrorDetailsState {
  return state;
}

/** The text Copy puts on the clipboard: the message, then the details. */
export function errorDetailsText({ message, details }: ErrorDetails): string {
  return `${message}\n\n${details}`;
}
