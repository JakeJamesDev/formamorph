import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BugReportList } from "@/components/menu/BugReportList";
import { BugThreadView } from "@/components/menu/BugThreadView";
import { BugReportDialog } from "@/components/menu/BugReportDialog";
import { BUG_SCOPES, BUG_SCOPE_LABELS, scopeFilterValue, type BugScope } from "@/lib/bugPresentation";

interface MyBugsTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Called after anything that changes the unread count, so the profile badge can be re-read. */
  onChanged?: () => void;
}

/** Profile → Bugs. The reader's own reports and the threads on them, or everyone's — the whole queue is
 *  readable so a bug can be checked against before it is filed twice. No triage controls either way:
 *  moving a report through triage is the team's call, not the reporter's. */
export function MyBugsTab({ active, onChanged }: MyBugsTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [filing, setFiling] = useState(false);
  // Opens on the reader's own: this tab is where their replies are, and its badge counts their threads.
  const [scope, setScope] = useState<BugScope>('mine');
  // Bumped after filing or replying, so the list picks the change up.
  const [nonce, setNonce] = useState(0);

  const changed = () => {
    setNonce((n) => n + 1);
    onChanged?.();
  };

  if (openId) {
    return (
      <BugThreadView
        reportId={openId}
        onBack={() => setOpenId(null)}
        onChanged={changed}
      />
    );
  }

  return (
    <div className="py-4 min-w-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted-foreground">
          {scope === 'mine'
            ? 'Bugs you’ve reported. Open one to see replies from the team.'
            : 'Every bug reported. Open one to read it — replies are between the reporter and the team.'}
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <Select value={scope} onValueChange={(value) => setScope(value as BugScope)}>
            <SelectTrigger className="w-36" aria-label="Which reports"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BUG_SCOPES.map((value) => (
                <SelectItem key={value} value={value}>{BUG_SCOPE_LABELS[value]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => setFiling(true)}>
            <Bug className="mr-2 h-4 w-4" /> Report a Bug
          </Button>
        </div>
      </div>

      <BugReportList
        active={active}
        scope={scopeFilterValue(scope)}
        refreshNonce={nonce}
        onOpen={setOpenId}
        emptyLabel={scope === 'mine' ? "You haven't reported anything yet." : 'Nothing has been reported yet.'}
      />

      <BugReportDialog open={filing} onOpenChange={setFiling} onFiled={changed} />
    </div>
  );
}
