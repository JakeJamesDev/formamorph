import { useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import { FeedbackDialog } from "@/components/menu/FeedbackDialog";
import {
  ANY_CATEGORY, CATEGORY_OPTIONS, FEEDBACK_SCOPES, FEEDBACK_SORTS, SCOPE_LABELS, SORT_LABELS,
  categoryFilterValue, scopeFilterValue,
} from "@/lib/feedbackPresentation";
import type { FeedbackScope, FeedbackSort } from "@/lib/feedbackPresentation";
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
  button: string;
  initialScope: FeedbackScope;
}> = {
  bug: {
    emptyMine: 'You haven’t reported anything yet.',
    emptyAll: 'Nothing has been reported yet.',
    button: 'Report a Bug',
    // Opens on their own: this is where their replies are, and the badge counts their threads.
    initialScope: 'mine',
  },
  suggestion: {
    emptyMine: 'You haven’t suggested anything yet.',
    emptyAll: 'Nothing has been suggested yet.',
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  const [scope, setScope] = useState<FeedbackScope>(COPY[type].initialScope);
  const [category, setCategory] = useState<FeedbackCategory | typeof ANY_CATEGORY>(ANY_CATEGORY);
  const [sort, setSort] = useState<FeedbackSort>('newest');
  // Bumped after filing or replying, so the list picks the change up.
  const [nonce, setNonce] = useState(0);

  // Staff who find a thread here are still the team, so they answer from here rather than being told
  // replies are somebody else's business. Triage stays in the Admin Panel.
  const viewerIsStaff = isStaff(AuthService.getCurrentUser());

  const changed = () => {
    setNonce((n) => n + 1);
    onChanged?.();
  };

  if (openId) {
    return (
      <FeedbackThreadView
        threadId={openId}
        isAdmin={viewerIsStaff}
        onBack={() => setOpenId(null)}
        onChanged={changed}
      />
    );
  }

  const copy = COPY[type];

  return (
    <div className="py-4 min-w-0">
      {/* The controls carry the whole row: a sentence saying what the tab is would leave no room for
          them, and the tab's own label already says it. */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          {/* Ranking only means something over everyone's; one person's own list is short. */}
          {type === 'suggestion' && scope === 'all' && (
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

          <Select value={scope} onValueChange={(value) => setScope(value as FeedbackScope)}>
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
        category={categoryFilterValue(category)}
        sort={sort}
        refreshNonce={nonce}
        onOpen={setOpenId}
        emptyLabel={scope === 'mine' ? copy.emptyMine : copy.emptyAll}
      />

      <FeedbackDialog open={filing} onOpenChange={setFiling} initialType={type} onFiled={changed} />
    </div>
  );
}
