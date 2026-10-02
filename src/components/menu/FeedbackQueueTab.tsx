import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import { useFeedbackListPlace } from "@/components/menu/useFeedbackListPlace";
import { useFeedbackFilters } from "@/components/menu/useFeedbackFilters";
import { StaffFilterRow } from "@/components/menu/FeedbackFilterRow";
import {
  FILTERED_EMPTY_LABELS, STAFF_HIDDEN_FILTERS, categoryFilterValue, staffFilterDefaults, statusFilterValue,
} from "@/lib/feedbackPresentation";
import type { FeedbackType } from "@/types";

interface FeedbackQueueTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Which branch this queue is for. */
  type: FeedbackType;
}

/**
 * Admin Panel → Bugs / Suggestions. The whole queue for one branch: filter by state, sort, open a
 * thread, answer it and triage it.
 */
export function FeedbackQueueTab({ active, type }: FeedbackQueueTabProps) {
  const { page, setPage, openId, open, back, nonce, refresh, listRef } = useFeedbackListPlace();
  const filters = useFeedbackFilters(staffFilterDefaults(type), STAFF_HIDDEN_FILTERS, () => setPage(1));
  const { status, category, sort } = filters.values;

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
        <StaffFilterRow type={type} filters={filters} />

        <FeedbackList
          active={active}
          type={type}
          scope="all"
          status={statusFilterValue(status, type)}
          category={categoryFilterValue(category)}
          sort={sort}
          search={filters.search}
          page={page}
          onPageChange={setPage}
          refreshNonce={nonce}
          onOpen={open}
          emptyLabel={FILTERED_EMPTY_LABELS[type]}
        />
      </div>
    </>
  );
}
