import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Flag, FileWarning, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UserName } from "@/components/UserName";
import { formatServerDateTime } from "@/lib/serverDate";
import { canModerate } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  REPORT_NOTE_MAX,
  reportCategoryLabel,
  reportCategoryTally,
  reportTargetTitle,
  sortReportGroups,
  withoutGroup,
  type ReportGroup,
  type ReportOutcome,
} from "@/lib/contentReports";
import ReportService from "@/services/ReportService";
import AuthService from "@/services/AuthService";
import { useUserProfile } from "@/contexts/userProfileStore";

interface ReportsTabProps {
  /** Whether the tab is visible; the queue only fetches while it is. */
  active: boolean;
  /** Opens a reported listing, or the listing a reported comment sits on — the only way to reach one in
   *  context. Absent leaves those groups as their snapshots; a reported *profile* opens through the app's
   *  own profile dialog and needs nothing from the caller. */
  onOpenListing?: (listingId: string) => void;
  /** Called after a resolution, so the panel's badge can re-read its count. */
  onResolved?: () => void;
}

/**
 * Admin Panel → Reports. What the room told staff about, one entry per reported target.
 *
 * Grouped rather than listed, because a pile-on is one piece of work: twelve people reporting the same
 * comment is one decision, not twelve. Resolving a group closes every open report in it and sends each
 * reporter a message — which is why the note field sits on the group and not on any one report.
 *
 * There are no moderation buttons here on purpose. Staff act with the tools they already have —
 * quarantine, takedown, comment delete, message, suspension — and then record what they decided.
 */
export function ReportsTab({ active, onOpenListing, onResolved }: ReportsTabProps) {
  const [groups, setGroups] = useState<ReportGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // The group whose note box is open, keyed by kind and id — one at a time.
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const me = AuthService.getCurrentUser();
  const { openProfile } = useUserProfile();

  /**
   * Where "View" goes for each kind of target.
   *
   * A profile opens the dialog the whole app opens names with. A listing opens itself. A comment opens
   * the listing it sits on — a comment has no address of its own, which is why the snapshot carries its
   * parent. Null means there is nothing to follow, and the button is not offered.
   */
  const viewTarget = (group: ReportGroup): (() => void) | null => {
    if (group.target_kind === 'profile') {
      return group.target_author_id
        ? () => openProfile(group.target_author_id, group.target_author_username)
        : null;
    }

    if (!onOpenListing) return null;

    const listingId = group.target_kind === 'comment' ? group.target_parent_id : group.target_id;

    return listingId ? () => onOpenListing(listingId) : null;
  };

  const keyOf = (group: ReportGroup) => `${group.target_kind}:${group.target_id}`;

  const load = useCallback(async () => {
    if (!active) return;

    setIsLoading(true);
    try {
      setGroups(sortReportGroups(await ReportService.fetchQueue()));
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load the report queue');
    } finally {
      setIsLoading(false);
    }
  }, [active]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (group: ReportGroup, outcome: ReportOutcome) => {
    const key = keyOf(group);
    setBusy(key);
    try {
      const result = await ReportService.resolve({
        targetKind: group.target_kind,
        targetId: group.target_id,
        outcome,
        note: noteFor === key ? note.trim() || undefined : undefined,
      });

      // Removed from the queue here rather than by refetching: the resolution already told us it closed,
      // and a refetch would flash the group back in for the round trip.
      setGroups((prev) => withoutGroup(prev, group));
      setNoteFor(null);
      setNote('');
      toast.success(result.notified === 1
        ? 'Resolved — the reporter has been told.'
        : `Resolved — ${result.notified} reporters have been told.`);
      onResolved?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to resolve these reports');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading && groups.length === 0) {
    return (
      <div className="py-4 space-y-3">
        {[0, 1, 2].map((row) => <Skeleton key={row} className="h-28 w-full" />)}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center text-helper text-muted-foreground">
        <Flag className="mx-auto mb-2 h-6 w-6 opacity-50" />
        Nothing has been reported.
      </div>
    );
  }

  return (
    <div className={cn("py-4 space-y-3 min-w-0", isLoading && "opacity-60")}>
      {groups.map((group) => {
        const key = keyOf(group);
        const view = viewTarget(group);
        // The client's copy of the rule the server enforces again: staff moderate the room, not each
        // other. Hiding the buttons is a courtesy — the refusal is the server's.
        const mayResolve = canModerate(me, group.target_author_id
          ? { id: group.target_author_id, accountType: group.target_author_role ?? 'normal' }
          : null);

        return (
          <div key={key} className="rounded-lg border border-border p-3 space-y-2 min-w-0">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <h3 className="text-label font-semibold truncate">{reportTargetTitle(group)}</h3>
                <p className="text-meta text-muted-foreground">
                  by <UserName userId={group.target_author_id} username={group.target_author_username} />
                  {' · '}
                  {group.report_count === 1 ? '1 report' : `${group.report_count} reports`}
                  {' · '}
                  last {formatServerDateTime(group.last_reported_at)}
                </p>
              </div>

              {view && !group.target_gone && (
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={view}>
                  <ExternalLink className="h-3.5 w-3.5" /> View
                </Button>
              )}
            </div>

            {/* Said loudly, because it changes what a moderator can do: the content is gone, the account
                is not, and the reporters are still owed an answer. */}
            {group.target_gone && (
              <p className="flex items-center gap-1.5 text-meta text-warning">
                <FileWarning className="h-3.5 w-3.5 shrink-0" />
                Removed by its author — judge from the snapshot below.
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {reportCategoryTally(group).map(({ category, count }) => (
                <span key={category} className="rounded bg-muted px-1.5 py-0.5 text-meta">
                  {reportCategoryLabel(category)}{count > 1 && ` ×${count}`}
                </span>
              ))}
            </div>

            {group.target_snippet && (
              <p className="rounded bg-muted/50 p-2 text-meta text-muted-foreground line-clamp-3">
                {group.target_snippet}
              </p>
            )}

            {/* What each reporter wrote, when they wrote anything. The names stay inside this panel and
                nowhere else — that is the promise the whole feature rests on. */}
            {group.reports.some((report) => report.details) && (
              <ul className="space-y-1">
                {group.reports.filter((report) => report.details).map((report) => (
                  <li key={report.id} className="text-meta text-muted-foreground">
                    <span className="font-medium text-foreground">{report.reporter_username || 'Deleted account'}</span>
                    {': '}{report.details}
                  </li>
                ))}
              </ul>
            )}

            {mayResolve ? (
              <div className="space-y-2">
                {noteFor === key && (
                  <div className="space-y-1">
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, REPORT_NOTE_MAX))}
                      placeholder="A line for the reporters (optional)"
                      aria-label="Note to the reporters"
                      className="h-20"
                    />
                    <p className="text-meta text-muted-foreground">
                      They are told the outcome, never which action was taken.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={busy === key}
                    onClick={() => resolve(group, 'actioned')}
                  >
                    Action Taken
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === key}
                    onClick={() => resolve(group, 'dismissed')}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === key}
                    onClick={() => {
                      setNoteFor(noteFor === key ? null : key);
                      setNote('');
                    }}
                  >
                    {noteFor === key ? 'Drop Note' : 'Add Note'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-meta text-muted-foreground">
                Reported content by another staff member — an admin closes this one.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
