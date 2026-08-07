import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import {
  ANY_CATEGORY, ANY_STATUS, CATEGORY_OPTIONS, FEEDBACK_SORTS, SORT_LABELS, STATUS_OPTIONS,
  UNRESOLVED_LABELS, UNRESOLVED_STATUS, categoryFilterValue, statusFilterValue,
} from "@/lib/feedbackPresentation";
import type { FeedbackSort } from "@/lib/feedbackPresentation";
import type { FeedbackCategory, FeedbackStatus, FeedbackType } from "@/types";

interface FeedbackQueueTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Which branch this queue is for. */
  type: FeedbackType;
}

/** Everything the status dropdown can hold: one state, every state, or every state still needing work. */
type StatusFilter = FeedbackStatus | typeof ANY_STATUS | typeof UNRESOLVED_STATUS;

/** What each queue opens on, and what it says when nothing matches. */
const COPY: Record<FeedbackType, { empty: string; initialStatus: StatusFilter }> = {
  bug: {
    empty: 'No reports match this filter.',
    // Opens on the work: a queue of everything ever resolved is not a queue. All of it, though — a
    // report waiting on the reporter or already reproduced is still a report nobody has fixed.
    initialStatus: UNRESOLVED_STATUS,
  },
  suggestion: {
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
  const [status, setStatus] = useState<StatusFilter>(COPY[type].initialStatus);
  const [category, setCategory] = useState<FeedbackCategory | typeof ANY_CATEGORY>(ANY_CATEGORY);
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
      {/* The controls carry the whole row: a sentence saying what the tab is would leave no room for
          them, and the tab's own label already says it. */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
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

          <Select value={category} onValueChange={(value) => setCategory(value as FeedbackCategory | typeof ANY_CATEGORY)}>
            <SelectTrigger className="w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_CATEGORY}>All categories</SelectItem>
              {CATEGORY_OPTIONS[type].map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger className="w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_STATUS}>All statuses</SelectItem>
              {/* Above the individual states: it is the one most of this queue's work is done from. */}
              <SelectItem value={UNRESOLVED_STATUS}>{UNRESOLVED_LABELS[type]}</SelectItem>
              {STATUS_OPTIONS[type].map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      <FeedbackList
        active={active}
        type={type}
        scope="all"
        status={statusFilterValue(status, type)}
        category={categoryFilterValue(category)}
        sort={sort}
        refreshNonce={nonce}
        onOpen={setOpenId}
        emptyLabel={COPY[type].empty}
      />
    </div>
  );
}
