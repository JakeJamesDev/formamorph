/** A bug report's filled-in fields. */
export interface BugReportFill {
  title: string;
  body: string;
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
