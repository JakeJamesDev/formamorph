import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import { useFeedbackListPlace } from "@/components/menu/useFeedbackListPlace";
import { FeedbackStatusSelect } from "@/components/menu/FeedbackStatusSelect";
import { FeedbackSearchInput } from "@/components/menu/FeedbackSearchInput";
import {
  ANY_CATEGORY, CATEGORY_OPTIONS, DEFAULT_STATUS_FILTER, SEARCH_LABELS, SORT_LABELS,
  categoryFilterValue, sortsFor, statusFilterValue,
} from "@/lib/feedbackPresentation";
import type { FeedbackSort, StatusFilter } from "@/lib/feedbackPresentation";
import type { FeedbackCategory, FeedbackType } from "@/types";

interface FeedbackQueueTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Which branch this queue is for. */
  type: FeedbackType;
}

/** What each queue says when nothing matches. */
const EMPTY: Record<FeedbackType, string> = {
  bug: 'No reports match this filter.',
  suggestion: 'No suggestions match this filter.',
};

/**
 * Admin Panel → Bugs / Suggestions. The whole queue for one branch: filter by state, sort, open a
 * thread, answer it and triage it.
 */
export function FeedbackQueueTab({ active, type }: FeedbackQueueTabProps) {
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_STATUS_FILTER[type]);
  const [category, setCategory] = useState<FeedbackCategory | typeof ANY_CATEGORY>(ANY_CATEGORY);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<FeedbackSort>(type === 'suggestion' ? 'votes' : 'newest');
  const { page, setPage, openId, open, back, nonce, refresh, listRef, refilter } = useFeedbackListPlace();

  return (
    <>
      {openId && (
        <FeedbackThreadView
          threadId={openId}
          isAdmin
          showTriage
          onBack={back}
          onChanged={refresh}
          onDeleted={back}
        />
      )}

      {/* Hidden, not unmounted, under an open thread: Back returns to the same rows. */}
      <div ref={listRef} hidden={openId !== null} className="py-4 min-w-0">
        {/* The controls carry the whole row: a sentence saying what the tab is would leave no room for
            them, and the tab's own label already says it. */}
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
            <FeedbackSearchInput value={search} onSearch={refilter(setSearch)} label={SEARCH_LABELS[type]} />

            <Select value={sort} onValueChange={refilter((value) => setSort(value as FeedbackSort))}>
              <SelectTrigger className="w-40" aria-label="Sort by"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sortsFor(type).map((value) => (
                  <SelectItem key={value} value={value}>{SORT_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={refilter((value) => setCategory(value as FeedbackCategory | typeof ANY_CATEGORY))}>
              <SelectTrigger className="w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_CATEGORY}>All categories</SelectItem>
                {CATEGORY_OPTIONS[type].map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <FeedbackStatusSelect type={type} value={status} onValueChange={refilter((value) => setStatus(value as StatusFilter))} />
        </div>

        <FeedbackList
          active={active}
          type={type}
          scope="all"
          status={statusFilterValue(status, type)}
          category={categoryFilterValue(category)}
          sort={sort}
          search={search}
          page={page}
          onPageChange={setPage}
          refreshNonce={nonce}
          onOpen={open}
          emptyLabel={EMPTY[type]}
        />
      </div>
    </>
  );
}
