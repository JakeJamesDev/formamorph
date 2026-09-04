import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tooltip";
import { StatusPill } from "@/components/StatusPill";
import { describeAccountAge } from "@/lib/accountAge";
import { formatServerDateTime, parseServerDate } from "@/lib/serverDate";
import type { LinkedAccount, LinkedMoment } from "@/types";

/** How old an account is now, in seconds, or null when its signup cannot be read. */
const ageSeconds = (createdAt: string): number | null => {
  const created = parseServerDate(createdAt);

  return created ? Math.max(0, Math.round((Date.now() - created.getTime()) / 1000)) : null;
};

/** One side of a link: what an account did from the shared address, and how much is not shown. */
function Moments({ label, moments, total }: { label: string; moments: LinkedMoment[]; total: number }) {
  return (
    <div className="min-w-0">
      <div className="text-meta uppercase tracking-wider text-muted-foreground">{label}</div>
      <ul className="mt-1 space-y-0.5">
        {moments.map((moment, index) => (
          <li key={`${moment.event}-${moment.at}-${index}`} className="text-helper text-muted-foreground">
            <span className="font-medium text-foreground">{moment.event}</span>
            {' · '}{formatServerDateTime(moment.at)}
            {' · '}{moment.browserFamily}
          </li>
        ))}
        {/* The server caps each side, so a long history says what it left out rather than lying by
            omission — the size of the overlap is half of what makes a link worth reading. */}
        {total > moments.length && (
          <li className="text-helper text-muted-foreground italic">
            and {total - moments.length} more
          </li>
        )}
      </ul>
    </div>
  );
}

interface LinkedAccountsPanelProps {
  /** The matches, newest first. Undefined while the row has not answered yet. */
  accounts: LinkedAccount[] | undefined;
  /** Whether the request is still out. */
  loading: boolean;
  /** Bring one of these accounts up in the table behind the panel. */
  onFind: (username: string) => void;
}

/**
 * The accounts that have acted from one of this account's network addresses.
 *
 * Both sides of every link are shown, because only the moments themselves separate a ring from two
 * people in one house. Nothing here acts on anybody: suspending and clearing likes stay the tools.
 */
export function LinkedAccountsPanel({ accounts, loading, onFind }: LinkedAccountsPanelProps) {
  if (loading || !accounts) {
    return <Skeleton className="h-16 w-full" aria-label="Loading linked accounts" />;
  }

  return (
    <ul className="space-y-3">
      {accounts.map((account) => (
        <li key={account.id} className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Searches the table behind this panel for them, which is where the actions are: this list
                reports, and the row is what a staff member acts from. The tip says so, because the
                search replaces whatever the table was showing. */}
            <Tip tip="Find this account in the table" labelsChild={false}>
              <button
                type="button"
                className="text-label font-medium text-foreground hover:underline"
                aria-label={`Find ${account.username} in the table`}
                onClick={() => onFind(account.username)}
              >
                {account.username}
              </button>
            </Tip>
            <StatusPill status={account.status} />
            <span className="text-helper text-muted-foreground">
              account {describeAccountAge(ageSeconds(account.createdAt))} old
            </span>
          </div>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Moments label="They did" moments={account.events} total={account.eventsTotal} />
            <Moments
              label="This account did"
              moments={account.subjectEvents}
              total={account.subjectEventsTotal}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
