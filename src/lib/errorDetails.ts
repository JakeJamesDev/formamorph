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

/** A fallback shown only when the error has no message, or a headline that is always shown. */
export type ToastText = string | { headline: string };

const MAX_STACK_FRAMES = 10;
const MAX_CAUSES = 5;
const NO_REASON = 'No reason was given.';

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;

const ownDetails = (error: unknown): string => {
  const details = field(error, 'details');
  return typeof details === 'string' ? details : '';
};

const ownMessage = (error: unknown): string => {
  const message = field(error, 'message');
  return typeof message === 'string' ? message : '';
};

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value === null || value === undefined) return NO_REASON;
  if (typeof value !== 'object') return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

// V8 stacks open with the message, whose lines can look like frames; Firefox frames read "fn@url:line:col".
function stackFrames(error: Error): string[] {
  let stack = error.stack ?? '';
  const at = error.message ? stack.indexOf(error.message) : -1;
  if (at !== -1) stack = stack.slice(at + error.message.length);
  return stack.split('\n').filter((line) => /^\s+at\s/.test(line) || /@.*:\d+:\d+$/.test(line)).slice(0, MAX_STACK_FRAMES);
}

function chainLines(error: unknown): string[] {
  const lines = [describe(error)];
  const own = ownDetails(error);
  if (own) lines.push(own);
  const seen = new Set<unknown>([error]);
  for (let cause = field(error, 'cause'); cause !== undefined && !seen.has(cause); cause = field(cause, 'cause')) {
    if (seen.size > MAX_CAUSES) { lines.push('Caused by: …'); break; }
    seen.add(cause);
    lines.push(`Caused by: ${describe(cause)}`);
    const details = ownDetails(cause);
    if (details) lines.push(details);
  }
  return lines;
}

function builtDetails(error: Error): string {
  const lines = chainLines(error);
  // An AggregateError's failures each keep their own name and details.
  const failures = field(error, 'errors');
  if (Array.isArray(failures)) {
    failures.forEach((failure, i) => lines.push('', `Failure ${i + 1} of ${failures.length}:`, ...chainLines(failure)));
  }
  const frames = stackFrames(error);
  if (frames.length) lines.push('', 'Stack:', ...frames);
  return lines.join('\n');
}

function detailsOf(error: unknown, movedMessage: string): string {
  const own = ownDetails(error);
  if (own) return movedMessage ? `${movedMessage}\n\n${own}` : own;
  if (error instanceof Error) return builtDetails(error);
  return describe(error);
}

/**
 * Turns a caught value into the toast text and the Error Details text. An error's own string
 * `details` field wins over built details; a headline replaces the message and moves it into the details.
 */
export function describeError(error: unknown, text: ToastText): ErrorDetails {
  const headline = typeof text === 'string' ? '' : text.headline;
  const fallback = typeof text === 'string' ? text : text.headline;
  // A failed result that carries only a string has no stack worth showing.
  if (typeof error === 'string') return { message: headline || error || fallback, details: error || NO_REASON };
  const message = ownMessage(error);
  return { message: headline || message || fallback, details: detailsOf(error, headline && message) };
}

/** The details, then the version, platform and system block every Error Details view ends with. */
export function detailsWithDiagnostics({ details }: ErrorDetails): string {
  return `${details}\n\n${formatDiagnostics(collectDiagnostics())}`;
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
export function errorDetailsText(entry: ErrorDetails): string {
  return `${entry.message}\n\n${detailsWithDiagnostics(entry)}`;
}