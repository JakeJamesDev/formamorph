import { collectDiagnostics, formatDiagnostics } from './bugDiagnostics';

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

const MAX_STACK_FRAMES = 10;
const MAX_CAUSES = 5;

const hasOwnDetails = (error: unknown): error is Error & { details: string } =>
  typeof (error as { details?: unknown } | null)?.details === 'string';

const describe = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error);

// V8 frames start with "at"; Firefox and Safari frames read "fn@url:line:col".
const stackFrames = (stack: string | undefined): string[] =>
  (stack ?? '').split('\n').filter((line) => /^\s+at\s/.test(line) || /@.*:\d+:\d+$/.test(line)).slice(0, MAX_STACK_FRAMES);

function builtDetails(error: Error): string {
  const lines = [describe(error)];
  let cause: unknown = error.cause;
  for (let depth = 0; cause !== undefined && depth < MAX_CAUSES; depth++) {
    lines.push(`Caused by: ${describe(cause)}`);
    cause = (cause as { cause?: unknown } | null)?.cause;
  }
  const frames = stackFrames(error.stack);
  if (frames.length) lines.push('', 'Stack:', ...frames);
  return lines.join('\n');
}

/**
 * Turns a caught value into the toast text and the Error Details text. An error's own string
 * `details` field wins over built details; a headline replaces the message and moves it into the details.
 */
export function describeError(error: unknown, fallback: string, headline?: string): ErrorDetails {
  // A failed result that carries only a string has no stack worth showing.
  if (typeof error === 'string') {
    const text = error || fallback;
    return headline ? { message: headline, details: text } : { message: text, details: text };
  }
  const own = (error as { message?: unknown } | null)?.message;
  const ownMessage = typeof own === 'string' ? own : '';
  const details = hasOwnDetails(error)
    ? (headline && ownMessage ? `${ownMessage}\n\n${error.details}` : error.details)
    : error instanceof Error ? builtDetails(error) : describe(error);
  return { message: headline || ownMessage || fallback, details };
}

/** The version, platform and system block every Error Details view ends with. */
export function diagnosticsBlock(): string {
  return formatDiagnostics(collectDiagnostics());
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

/** The text Copy puts on the clipboard: the message, the details, then the diagnostics block. */
export function errorDetailsText({ message, details }: ErrorDetails): string {
  return `${message}\n\n${details}\n\n${diagnosticsBlock()}`;
}
