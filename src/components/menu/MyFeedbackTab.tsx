import { useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import { FeedbackDialog } from "@/components/menu/FeedbackDialog";
import { useFeedbackListPlace } from "@/components/menu/useFeedbackListPlace";
import { FeedbackStatusSelect } from "@/components/menu/FeedbackStatusSelect";
import { FeedbackSearchInput } from "@/components/menu/FeedbackSearchInput";
import {
  ANY_CATEGORY, CATEGORY_OPTIONS, DEFAULT_STATUS_FILTER, FEEDBACK_SCOPES, SCOPE_LABELS, SEARCH_LABELS, SORT_LABELS,
  categoryFilterValue, scopeFilterValue, sortsFor, statusFilterValue,
} from "@/lib/feedbackPresentation";
import type { FeedbackScope, FeedbackSort, StatusFilter } from "@/lib/feedbackPresentation";
import AuthService from "@/services/AuthService";
import { isStaff } from "@/lib/roles";
import type { FeedbackCategory, FeedbackType } from "@/types";

interface MyFeedbackTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Which branch this tab is for. */
  type: FeedbackType;
  /** Called after anything that changes the unread count, so the profile badge can be re-read. */
  onChanged?: () => void;
}

/** Which scope each tab opens on, what its file button offers, and what it says when nothing matches. */
const COPY: Record<FeedbackType, {
  emptyMine: string;
  emptyAll: string;
  emptySearch: string;
  button: string;
  initialScope: FeedbackScope;
}> = {
  bug: {
    emptyMine: 'You haven’t reported anything yet.',
    emptyAll: 'Nothing has been reported yet.',
    emptySearch: 'No reports match this search.',
    button: 'Report a Bug',
    // Opens on their own: this is where their replies are, and the badge counts their threads.
    initialScope: 'mine',
  },
  suggestion: {
    emptyMine: 'You haven’t suggested anything yet.',
    emptyAll: 'Nothing has been suggested yet.',
    emptySearch: 'No suggestions match this search.',
    button: 'Suggest Something',
    // Opens on everyone's: a board is for browsing and voting, and mine-first buries the point.
    initialScope: 'all',
  },
};

/**
 * Profile → Bugs / Suggestions. One branch of the tree from the reader's side: their own threads, or
 * everyone's. No triage controls either way — moving something through triage is the team's call, even
 * when the reader happens to be on the team.
 */
export function MyFeedbackTab({ active, type, onChanged }: MyFeedbackTabProps) {
  const { page, setPage, openId, open, back, nonce, refresh, listRef, refilter } = useFeedbackListPlace();
  const [filing, setFiling] = useState(false);
  const [scope, setScope] = useState<FeedbackScope>(COPY[type].initialScope);
  const [status, setStatus] = useState<StatusFilter>(DEFAULT_STATUS_FILTER[type]);
  const [category, setCategory] = useState<FeedbackCategory | typeof ANY_CATEGORY>(ANY_CATEGORY);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<FeedbackSort>('newest');

  // Staff who find a thread here are still the team, so they answer from here rather than being told
  // replies are somebody else's business. Triage stays in the Admin Panel.
  const viewerIsStaff = isStaff(AuthService.getCurrentUser());

  const changed = () => {
    refresh();
    onChanged?.();
  };

  const copy = COPY[type];

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

            <Select value={scope} onValueChange={refilter((value) => setScope(value as FeedbackScope))}>
              <SelectTrigger className="w-36" aria-label="Which threads"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FEEDBACK_SCOPES.map((value) => (
                  <SelectItem key={value} value={value}>{SCOPE_LABELS[type][value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" onClick={() => setFiling(true)}>
              {type === 'bug' ? <Bug className="mr-2 h-4 w-4" /> : <Lightbulb className="mr-2 h-4 w-4" />}
              {copy.button}
            </Button>
        </div>

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
          emptyLabel={search ? copy.emptySearch : scope === 'mine' ? copy.emptyMine : copy.emptyAll}
        />

        <FeedbackDialog open={filing} onOpenChange={setFiling} initialType={type} onFiled={changed} />
      </div>
    </>
  );
}
