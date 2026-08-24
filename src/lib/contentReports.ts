/**
 * Content Reports' logic, with no React in it: what may be reported and for what, whether a draft is
 * worth sending, how a pile-on reads as one item of work, and how to tell a server that has never heard
 * of any of this from a queue that simply has nothing in it.
 *
 * That last one is the reason this is a module rather than a handful of helpers inside the dialog. The
 * client and the community server ship separately — and the server here is somebody else's live
 * production deployment — so every surface has to answer "is this feature here at all?" the same way,
 * and answer it from the payload rather than from a version number nobody sends.
 */

/** What a Report says is wrong. The order is the server's, worst first. */
export const REPORT_CATEGORIES = ['illegal', 'hate', 'spam', 'stolen', 'malicious', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** How each category reads to the person picking one. */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  illegal: 'Illegal content',
  hate: 'Hate or harassment',
  spam: 'Spam or scam',
  stolen: 'Stolen content',
  malicious: 'Malicious content or links',
  other: 'Other',
};

/** What can be reported. A changelog entry is reported through its listing, not on its own. */
export const REPORT_TARGET_KINDS = ['listing', 'comment', 'profile'] as const;
export type ReportTargetKind = (typeof REPORT_TARGET_KINDS)[number];

/** How each kind reads in a heading or a queue row. */
export const REPORT_TARGET_LABELS: Record<ReportTargetKind, string> = {
  listing: 'Listing',
  comment: 'Comment',
  profile: 'Profile',
};

/** How a group closes. Two values, because a reporter is owed the answer and never the method. */
export const REPORT_OUTCOMES = ['actioned', 'dismissed'] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

/** How each outcome reads on the button that applies it. */
export const REPORT_OUTCOME_LABELS: Record<ReportOutcome, string> = {
  actioned: 'Action Taken',
  dismissed: 'Dismiss',
};

/** The server's cap on a reporter's own words, repeated so the field can stop rather than be refused. */
export const REPORT_DETAILS_MAX = 2000;

/** The server's cap on the staff note that rides along with the outcome. */
export const REPORT_NOTE_MAX = 1000;

/** What the report dialog holds before it is sent. */
export interface ReportDraft {
  category: ReportCategory | null;
  details: string;
}

/** One report as the staff queue receives it. Snake-cased: this is the server's row, not a view model. */
export interface QueuedReport {
  id: string;
  reporter_id: string | null;
  reporter_username: string | null;
  category: string;
  details: string | null;
  created_at: string;
  target_gone_at: string | null;
}

/** One reported target, with every open report on it. The unit of work in the queue. */
export interface ReportGroup {
  target_kind: ReportTargetKind;
  target_id: string;
  target_name: string | null;
  target_author_id: string | null;
  target_author_username: string | null;
  /**
   * What the author's account is *now*, not what it was when the report was filed.
   *
   * The one live field on an otherwise snapshotted group, because it decides who may close it: a
   * snapshot would leave the queue offering a button the server then refuses.
   */
  target_author_role: string | null;
  target_snippet: string | null;
  /** Where the target sits, when it sits inside something: a comment's listing. Null for the rest. */
  target_parent_id: string | null;
  report_count: number;
  first_reported_at: string;
  last_reported_at: string;
  /** Whether the content was taken away by its own author while the reports were still open. */
  target_gone: boolean;
  reports: QueuedReport[];
}

/**
 * Whether this server has Content Reports at all.
 *
 * The whole of graceful degradation. A server that has the feature answers `/reports/meta` with a
 * category list; one that predates it 404s, and every report control on every surface stays off screen
 * rather than offering an action that would fail. Read from the payload, never from a version number.
 *
 * @param meta - Whatever `/reports/meta` returned, or null when the request failed
 * @returns Whether to show any report control at all
 */
export function serverSupportsReports(meta: { categories?: unknown } | null | undefined): boolean {
  return Array.isArray(meta?.categories) && meta.categories.length > 0;
}

/**
 * The first thing wrong with a draft, or null when it is ready to send.
 *
 * The same rules the server applies, so a refusal is something the reporter reads before the round trip
 * rather than after it. The server still checks — this only keeps the obvious cases off the wire.
 *
 * @param draft - What the dialog holds
 * @returns The message to show, or null
 */
export function reportDraftError(draft: ReportDraft): string | null {
  if (!draft.category) return 'Pick what is wrong with it.';
  if (draft.details.trim().length > REPORT_DETAILS_MAX) {
    return `Details are ${REPORT_DETAILS_MAX} characters at most.`;
  }

  return null;
}

/**
 * What a group is about, in one line.
 *
 * Built from the snapshot rather than from the target, because the target may be gone — which is exactly
 * when a moderator most needs to be told what it was.
 *
 * @param group - The queue group
 * @returns A phrase like `Comment on "Sedge Landing"`
 */
export function reportTargetTitle(group: ReportGroup): string {
  const kind = REPORT_TARGET_LABELS[group.target_kind] ?? 'Content';

  if (!group.target_name) return kind;

  return group.target_kind === 'comment'
    ? `${kind} on "${group.target_name}"`
    : `${kind}: ${group.target_name}`;
}

/**
 * Which categories a group was reported under, each with how many said so.
 *
 * Counted rather than listed, because the interesting fact about a pile-on is the shape of the agreement:
 * six people calling something spam is a different piece of work from three spam and three hate.
 *
 * @param group - The queue group
 * @returns The categories, most-reported first
 */
export function reportCategoryTally(group: ReportGroup): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const report of group.reports) {
    counts.set(report.category, (counts.get(report.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => (b.count - a.count) || a.category.localeCompare(b.category));
}

/**
 * How a category reads, falling back to the raw value.
 *
 * The fallback is not defensive padding: the server owns this list, and a deploy that adds a category
 * ahead of the client would otherwise render a blank chip where a word should be.
 *
 * @param category - A category as the server sent it
 * @returns Its label
 */
export function reportCategoryLabel(category: string): string {
  return REPORT_CATEGORY_LABELS[category as ReportCategory] ?? category;
}

/**
 * The queue, worst-first.
 *
 * Sorted here as well as in the SQL, because the tab keeps working after it has removed a group it just
 * resolved — and because "worst" is a client judgment: a target somebody called illegal outranks one
 * three people called spam, whatever order the rows arrived in.
 *
 * @param groups - The groups in any order
 * @returns A new array, most severe first, then most reported, then most recent
 */
export function sortReportGroups(groups: ReportGroup[]): ReportGroup[] {
  const severity = (group: ReportGroup) => Math.min(
    ...group.reports.map((report) => {
      const index = (REPORT_CATEGORIES as readonly string[]).indexOf(report.category);
      return index === -1 ? REPORT_CATEGORIES.length : index;
    }),
    REPORT_CATEGORIES.length,
  );

  return [...groups].sort((a, b) =>
    (severity(a) - severity(b))
    || (b.report_count - a.report_count)
    || ((a.last_reported_at < b.last_reported_at) ? 1 : -1));
}

/**
 * A group with one target's reports taken out of the queue, for after a resolution.
 *
 * @param groups - The queue as it stands
 * @param target - The kind and id just resolved
 * @returns A new array without that group
 */
export function withoutGroup(
  groups: ReportGroup[],
  target: { target_kind: string; target_id: string },
): ReportGroup[] {
  return groups.filter((group) =>
    !(group.target_kind === target.target_kind && group.target_id === target.target_id));
}
