import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import {
  ANY_STATUS, FEEDBACK_SORTS, SORT_LABELS, STATUS_OPTIONS, statusFilterValue,
} from "@/lib/feedbackPresentation";
import type { FeedbackSort } from "@/lib/feedbackPresentation";
import type { FeedbackStatus, FeedbackType } from "@/types";

interface FeedbackQueueTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Which branch this queue is for. */
  type: FeedbackType;
}

/** What each queue says it is, and what it opens on. */
const COPY: Record<FeedbackType, { blurb: string; empty: string; initialStatus: FeedbackStatus | typeof ANY_STATUS }> = {
  bug: {
    blurb: 'Reports filed by users. Open one to answer it or move it through triage.',
    empty: 'No reports match this filter.',
    // Opens on the work: a queue of everything ever resolved is not a queue.
    initialStatus: 'open',
  },
  suggestion: {
    blurb: 'Everything users have suggested. Open one to answer it or move it through triage.',
    empty: 'No suggestions match this filter.',
    // Opens on everything: what matters here is what is most wanted, whatever state it is in.
    initialStatus: ANY_STATUS,
  },
};

/**
 * Admin Panel → Bugs / Suggestions. The whole queue for one branch: filter by state, sort, open a
 * thread, answer it and triage it.
 */
export function FeedbackQueueTab({ active, type }: FeedbackQueueTabProps) {
  const [status, setStatus] = useState<FeedbackStatus | typeof ANY_STATUS>(COPY[type].initialStatus);
  const [sort, setSort] = useState<FeedbackSort>(type === 'suggestion' ? 'votes' : 'newest');
  const [openId, setOpenId] = useState<string | null>(null);
  // Bumped after anything that changes a thread, so the list behind it picks it up.
  const [nonce, setNonce] = useState(0);

  if (openId) {
    return (
      <FeedbackThreadView
        threadId={openId}
        isAdmin
        showTriage
        onBack={() => setOpenId(null)}
        onChanged={() => setNonce((n) => n + 1)}
        onDeleted={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="py-4 min-w-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted-foreground">{COPY[type].blurb}</p>

        <div className="flex shrink-0 items-center gap-2">
          {/* Suggestions are ranked; a bug queue has nothing to rank by. */}
          {type === 'suggestion' && (
            <Select value={sort} onValueChange={(value) => setSort(value as FeedbackSort)}>
              <SelectTrigger className="w-36" aria-label="Sort by"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEEDBACK_SORTS.map((value) => (
                  <SelectItem key={value} value={value}>{SORT_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={status} onValueChange={(value) => setStatus(value as FeedbackStatus | typeof ANY_STATUS)}>
            <SelectTrigger className="w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_STATUS}>All statuses</SelectItem>
              {STATUS_OPTIONS[type].map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FeedbackList
        active={active}
        type={type}
        scope="all"
        status={statusFilterValue(status)}
        sort={sort}
        refreshNonce={nonce}
        onOpen={setOpenId}
        emptyLabel={COPY[type].empty}
      />
    </div>
  );
}
