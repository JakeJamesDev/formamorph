import type { ErrorDetails } from './errorDetails';
import { FEEDBACK_BODY_MAX, FEEDBACK_TITLE_MAX } from './feedbackDraft';

/** A bug report's filled-in fields. */
export interface BugReportFill {
  title: string;
  body: string;
}

const CUT_NOTE = '\n\n[The details are cut to fit this report. “Copy” in “Error Details” has the full text.]';

/**
 * The bug report's fields for this error: the message as the title and the details as the description,
 * each cut to the report's limit. The diagnostics block stays out, because the report attaches its own.
 */
export function bugReportFromError({ message, details }: ErrorDetails): BugReportFill {
  const title = message.length > FEEDBACK_TITLE_MAX ? `${message.slice(0, FEEDBACK_TITLE_MAX - 1)}…` : message;
  const body = details.length > FEEDBACK_BODY_MAX
    ? `${details.slice(0, FEEDBACK_BODY_MAX - CUT_NOTE.length)}${CUT_NOTE}`
    : details;
  return { title, body };
}

interface BugReportState {
  open: boolean;
  // Kept after close so the dialog's exit animation still has its fields.
  fill: BugReportFill | null;
}

let state: BugReportState = { open: false, fill: null };
const listeners = new Set<() => void>();
const publish = (next: BugReportState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

/** Opens the shared bug report with these fields, replacing any unsent draft. */
export function openBugReport(fill: BugReportFill): void {
  publish({ open: true, fill });
}

export function closeBugReport(): void {
  publish({ ...state, open: false });
}

export function subscribeBugReport(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getBugReportState(): BugReportState {
  return state;
}
