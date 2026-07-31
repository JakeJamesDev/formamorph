import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BugReportList } from "@/components/menu/BugReportList";
import { BugThreadView } from "@/components/menu/BugThreadView";
import { ANY_STATUS, BUG_STATUS_OPTIONS, statusFilterValue } from "@/lib/bugPresentation";
import type { BugStatus } from "@/types";

interface BugsTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
}

/** Admin Panel → Bugs. The whole queue: filter by triage state, open a thread, answer and triage it. */
export function BugsTab({ active }: BugsTabProps) {
  const [status, setStatus] = useState<BugStatus | typeof ANY_STATUS>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  // Bumped after anything that changes a report, so the list behind the thread picks it up.
  const [nonce, setNonce] = useState(0);

  if (openId) {
    return (
      <BugThreadView
        reportId={openId}
        isAdmin
        onBack={() => setOpenId(null)}
        onChanged={() => setNonce((n) => n + 1)}
        onDeleted={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="py-4 min-w-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm text-muted-foreground">
          Reports filed by users. Open one to answer it or move it through triage.
        </p>

        <Select value={status} onValueChange={(value) => setStatus(value as BugStatus | typeof ANY_STATUS)}>
          <SelectTrigger className="w-40 shrink-0" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_STATUS}>All statuses</SelectItem>
            {BUG_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BugReportList
        active={active}
        scope="all"
        status={statusFilterValue(status)}
        refreshNonce={nonce}
        onOpen={setOpenId}
        emptyLabel="No reports match this filter."
      />
    </div>
  );
}
