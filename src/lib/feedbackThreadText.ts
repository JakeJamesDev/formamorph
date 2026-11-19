import { formatDiagnostics } from './bugDiagnostics';
import { FEEDBACK_CATEGORY_LABELS, formatFeedbackDate, statusStyle } from './feedbackPresentation';
import type { FeedbackDetail } from '@/types';

/** A thread as plain text for staff to paste elsewhere: the report, its diagnostics, then every reply. */
export function feedbackThreadText({ thread, comments }: FeedbackDetail): string {
  const header = [
    `#${thread.number} ${thread.title}`,
    [
      FEEDBACK_CATEGORY_LABELS[thread.category],
      statusStyle(thread.status).label,
      ...(thread.locked ? ['Locked'] : []),
      thread.reporter.username,
      formatFeedbackDate(thread.createdAt),
    ].join(' · '),
  ].join('\n');
  const replies = comments.map((comment) =>
    `--- ${comment.author.username} · ${formatFeedbackDate(comment.createdAt)}\n${comment.body}`);
  return [header, thread.body, formatDiagnostics(thread.diagnostics), ...replies].filter(Boolean).join('\n\n');
}
