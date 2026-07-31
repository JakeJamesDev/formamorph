import { useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeedbackList } from "@/components/menu/FeedbackList";
import { FeedbackThreadView } from "@/components/menu/FeedbackThreadView";
import { FeedbackDialog } from "@/components/menu/FeedbackDialog";
import {
  FEEDBACK_SCOPES, FEEDBACK_SORTS, SCOPE_LABELS, SORT_LABELS, scopeFilterValue,
} from "@/lib/feedbackPresentation";
import type { FeedbackScope, FeedbackSort } from "@/lib/feedbackPresentation";
import AuthService from "@/services/AuthService";
import type { FeedbackType } from "@/types";

interface MyFeedbackTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Which branch this tab is for. */
  type: FeedbackType;
  /** Called after anything that changes the unread count, so the profile badge can be re-read. */
  onChanged?: () => void;
}

/** What each tab says it is, which scope it opens on, and what its file button offers. */
const COPY: Record<FeedbackType, {
  mine: string;
  all: string;
  emptyMine: string;
  emptyAll: string;
  button: string;
  initialScope: FeedbackScope;
}> = {
  bug: {
    mine: 'Bugs you’ve reported. Open one to see replies from the team.',
    all: 'Every bug reported. Open one to read it — replies are between the reporter and the team.',
    emptyMine: 'You haven’t reported anything yet.',
    emptyAll: 'Nothing has been reported yet.',
    button: 'Report a Bug',
    // Opens on their own: this is where their replies are, and the badge counts their threads.
    initialScope: 'mine',
  },
  suggestion: {
    mine: 'Suggestions you’ve made. Open one to see where it stands.',
    all: 'Everything people have suggested. Vote for what you want, and say your piece.',
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
  const [sort, setSort] = useState<FeedbackSort>('newest');
  // Bumped after filing or replying, so the list picks the change up.
  const [nonce, setNonce] = useState(0);

  // An admin who finds a thread here is still the team, so they answer from here rather than being told
  // replies are somebody else's business. Triage stays in the Admin Panel.
  const isAdmin = AuthService.getCurrentUser()?.accountType === 'admin';

  const changed = () => {
    setNonce((n) => n + 1);
    onChanged?.();
  };

  if (openId) {
    return (
      <FeedbackThreadView
        threadId={openId}
        isAdmin={isAdmin}
        onBack={() => setOpenId(null)}
        onChanged={changed}
      />
    );
  }

  const copy = COPY[type];

  return (
    <div className="py-4 min-w-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted-foreground">{scope === 'mine' ? copy.mine : copy.all}</p>

        <div className="flex shrink-0 items-center gap-2">
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
      </div>

      <FeedbackList
        active={active}
        type={type}
        scope={scopeFilterValue(scope)}
        sort={sort}
        refreshNonce={nonce}
        onOpen={setOpenId}
        emptyLabel={scope === 'mine' ? copy.emptyMine : copy.emptyAll}
      />

      <FeedbackDialog open={filing} onOpenChange={setFiling} initialType={type} onFiled={changed} />
    </div>
  );
}
