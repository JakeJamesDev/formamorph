import { isStaff } from '@/lib/roles';
import { CATEGORY_OPTIONS } from '@/lib/feedbackPresentation';
import type { FeedbackThread, FeedbackType } from '@/types';

/** An account as the client holds it. */
interface Viewer {
  id?: unknown;
  accountType?: unknown;
  [key: string]: unknown;
}

/**
 * Whether this reader may rewrite a thread's title and description.
 *
 * A bug is a work item for the team, so a poorly written one can be made useful. A suggestion is
 * somebody's idea on a public board and stays in their words — the rule every comment already follows.
 * A lock closes the reporter's own editing; the team is never locked out of its own queue.
 *
 * @param thread - The thread
 * @param viewer - The signed-in account
 * @returns Whether to offer the title and description fields
 */
export function mayEditProse(thread: FeedbackThread | null, viewer: Viewer | null | undefined): boolean {
  if (!thread) return false;
  if (isStaff(viewer)) return thread.type === 'bug';

  return Boolean(viewer?.id) && thread.reporter.id === viewer?.id && !thread.locked;
}

/**
 * Whether this reader may change a thread's category or move it between branches.
 *
 * Triage either way, so it is the team's alone — including on somebody's own report.
 *
 * @param viewer - The signed-in account
 * @returns Whether to offer the category and type controls
 */
export function mayRefile(viewer: Viewer | null | undefined): boolean {
  return isStaff(viewer);
}

/** Whether there is anything at all for this reader to edit. */
export const mayEditAnything = (thread: FeedbackThread | null, viewer: Viewer | null | undefined): boolean =>
  mayEditProse(thread, viewer) || mayRefile(viewer);

/** What an edit dialog holds while it is open. */
export interface EditDraft {
  title: string;
  body: string;
  category: string;
  type: string;
}

/**
 * The fields that actually changed, ready to send.
 *
 * Only what moved: the server writes exactly what it is given, so sending an untouched field would stamp
 * the thread as edited for nothing. Fields this reader may not change are never included, whatever the
 * draft holds.
 *
 * @param draft - The dialog's current values
 * @param thread - The thread as it was loaded
 * @param permissions - What this reader may change
 * @returns The changed subset, empty when nothing moved
 */
export function changedFields(
  draft: EditDraft,
  thread: FeedbackThread,
  permissions: { prose: boolean; refile: boolean }
): Partial<EditDraft> {
  const changes: Partial<EditDraft> = {};

  if (permissions.prose) {
    if (draft.title.trim() !== thread.title) changes.title = draft.title.trim();
    if (draft.body.trim() !== thread.body) changes.body = draft.body.trim();
  }

  if (permissions.refile) {
    if (draft.type !== thread.type) changes.type = draft.type;
    // A type move takes the category with it whether or not the reader touched that control: the two
    // lists share only three values, so the old one is usually not a value the new branch has.
    if (draft.category !== thread.category || changes.type) changes.category = draft.category;
  }

  return changes;
}

/**
 * The category a draft should carry after moving to another branch.
 *
 * The two lists share only `editor`, `community` and `other`, so a category is kept when the new branch
 * has it and replaced with that branch's first otherwise — `crash` has no honest answer as a suggestion.
 * Never left invalid: the server refuses a move naming a category the new type does not have.
 *
 * @param nextType - The branch being moved to
 * @param category - The category currently selected
 * @returns The category to select
 */
export function categoryForType(nextType: string, category: string): string {
  const options = CATEGORY_OPTIONS[nextType as FeedbackType];
  if (!options) return category;

  return options.some((option) => option.value === category) ? category : options[0].value;
}
