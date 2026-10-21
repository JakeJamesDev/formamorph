import type { ErrorDetails } from './errorDetails';
import { FEEDBACK_BODY_MAX, FEEDBACK_TITLE_MAX } from './feedbackDraft';

/** A bug report's filled-in fields. */
export interface BugReportFill {
  title: string;
  body: string;
}

const CUT_NOTE = '\n\n[The details are cut to fit this report. “Copy” in “Error Details” has the full text.]';

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
export function bugReportFromError({ message, details }: ErrorDetails): BugReportFill {
  const title = message.length > FEEDBACK_TITLE_MAX ? `${message.slice(0, FEEDBACK_TITLE_MAX - 1)}…` : message;
  const fence = fenceFor(details);
  const wrap = (text: string) => `${fence}\n${text}\n${fence}`;
  const whole = wrap(details);
  const body = whole.length > FEEDBACK_BODY_MAX
    ? `${wrap(details.slice(0, FEEDBACK_BODY_MAX - (whole.length - details.length) - CUT_NOTE.length))}${CUT_NOTE}`
    : whole;
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
