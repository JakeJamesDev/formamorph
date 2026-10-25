import type { FeedbackType } from '@/types';
import type { ErrorDetails } from './errorDetails';
import { FEEDBACK_BODY_MAX, FEEDBACK_TITLE_MAX } from './feedbackDraft';

/** A report's filled-in fields. */
export interface FeedbackFill {
  title: string;
  body: string;
}

const CUT_NOTE = '\n\n[The details are cut to fit this report. “Copy” in “Error Details” has the full text.]';

/** `text` cut to the title limit, with an ellipsis when it was cut. */
function fitTitle(text: string): string {
  return text.length > FEEDBACK_TITLE_MAX ? `${text.slice(0, FEEDBACK_TITLE_MAX - 1)}…` : text;
}

/** A code fence one backtick longer than the longest run in `text`, so the text can't close it. */
function fenceFor(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  return '`'.repeat(Math.max(3, longest + 1));
}

/**
 * The bug report's fields for this error: the message as the title and the details, fenced so the
 * markdown viewer shows them as written, as the description. Each is cut to the report's limit.
 * The diagnostics block stays out, because the report attaches its own.
 */
export function bugReportFromError({ message, details }: ErrorDetails): FeedbackFill {
  const fence = fenceFor(details);
  const wrap = (text: string) => `${fence}\n${text}\n${fence}`;
  const whole = wrap(details);
  const body = whole.length > FEEDBACK_BODY_MAX
    ? `${wrap(details.slice(0, FEEDBACK_BODY_MAX - (whole.length - details.length) - CUT_NOTE.length))}${CUT_NOTE}`
    : whole;
  return { title: fitTitle(message), body };
}

/** A new question's fields for a help question: its whitespace collapsed, cut to the title limit. Null for no text. */
export function questionFromHelp(question: string): FeedbackFill | null {
  const title = question.replace(/\s+/g, ' ').trim();
  return title ? { title: fitTitle(title), body: '' } : null;
}

interface FeedbackOpenerState {
  open: boolean;
  type: FeedbackType;
  // Kept after close so the dialog's exit animation still has its fields.
  fill: FeedbackFill | null;
  /** The control focus goes back to on close. */
  opener: HTMLElement | null;
}

let state: FeedbackOpenerState = { open: false, type: 'bug', fill: null, opener: null };
const listeners = new Set<() => void>();
const publish = (next: FeedbackOpenerState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Opens the shared Feedback dialog on `type`. A fill over an unsent draft asks before it replaces the draft. */
export function openFeedback(type: FeedbackType, fill: FeedbackFill | null, opener: HTMLElement | null = null): void {
  publish({ open: true, type, fill, opener });
}

export function closeFeedback(): void {
  publish({ ...state, open: false });
}

export function subscribeFeedback(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getFeedbackState(): FeedbackOpenerState {
  return state;
}
