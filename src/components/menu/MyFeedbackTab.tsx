import { useState } from "react";
import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import { FeedbackDialog } from "@/components/menu/FeedbackDialog";
import { useFeedbackListPlace } from "@/components/menu/useFeedbackListPlace";
import { useFeedbackFilters } from "@/components/menu/useFeedbackFilters";
import { UserFilterRow } from "@/components/menu/FeedbackFilterRow";
import {
  ANY_STATUS, FILTERED_EMPTY_LABELS, USER_HIDDEN_FILTERS,
  categoryFilterValue, scopeFilterValue, statusFilterValue, userFilterDefaults,
} from "@/lib/feedbackPresentation";
import AuthService from "@/services/AuthService";
import { isStaff } from "@/lib/roles";
import type { FeedbackType } from "@/types";

interface MyFeedbackTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Which branch this tab is for. */
  type: FeedbackType;
  /** Called after anything that changes the unread count, so the profile badge can be re-read. */
  onChanged?: () => void;
}

/** What each tab's file button offers, and what it says when nothing matches. */
const COPY: Record<FeedbackType, {
  emptyMine: string;
  emptyAll: string;
  emptySearch: string;
  button: string;
}> = {
  bug: {
    emptyMine: 'You haven’t reported anything yet.',
    emptyAll: 'Nothing has been reported yet.',
    emptySearch: 'No reports match this search.',
    button: 'Report a Bug',
  },
  suggestion: {
    emptyMine: 'You haven’t suggested anything yet.',
    emptyAll: 'Nothing has been suggested yet.',
    emptySearch: 'No suggestions match this search.',
    button: 'Suggest Something',
  },
};

/**
 * Profile → Bugs / Suggestions. One branch of the tree from the reader's side: their own threads, or
 * everyone's. No triage controls either way — moving something through triage is the team's call, even
 * when the reader happens to be on the team.
 */
export function MyFeedbackTab({ active, type, onChanged }: MyFeedbackTabProps) {
  const { page, setPage, openId, open, back, nonce, refresh, listRef } = useFeedbackListPlace();
  const filters = useFeedbackFilters(userFilterDefaults(type), USER_HIDDEN_FILTERS, () => setPage(1));
  const { search } = filters;
  const { status, category, sort, scope } = filters.values;
  const [filing, setFiling] = useState(false);

  // Staff who find a thread here are still the team, so they answer from here rather than being told
  // replies are somebody else's business. Triage stays in the Admin Panel.
  const viewerIsStaff = isStaff(AuthService.getCurrentUser());

  const changed = () => {
    refresh();
    onChanged?.();
  };

  const copy = COPY[type];
  // A search names itself, a narrowed status says the filter hid the threads, and only the widest view can say none exist.
  const emptyLabel = search
    ? copy.emptySearch
    : status !== ANY_STATUS
      ? FILTERED_EMPTY_LABELS[type]
      : scope === 'mine' ? copy.emptyMine : copy.emptyAll;

  return (
    <>
      {openId && (
        <FeedbackThreadView
          threadId={openId}
          isAdmin={viewerIsStaff}
          onBack={back}
          onChanged={changed}
        />
      )}

      {/* Hidden, not unmounted, under an open thread: Back returns to the same rows. */}
      <div ref={listRef} hidden={openId !== null} className="py-4 min-w-0">
        <UserFilterRow type={type} filters={filters} fileLabel={copy.button} onFile={() => setFiling(true)} />

        <FeedbackList
          active={active}
          type={type}
          scope={scopeFilterValue(scope)}
          status={statusFilterValue(status, type)}
          category={categoryFilterValue(category)}
          sort={sort}
          search={search}
          page={page}
          onPageChange={setPage}
          refreshNonce={nonce}
          onOpen={open}
          emptyLabel={emptyLabel}
        />

        <FeedbackDialog open={filing} onOpenChange={setFiling} initialType={type} onFiled={changed} />
      </div>
    </>
  );
}
