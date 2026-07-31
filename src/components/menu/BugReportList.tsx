import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BUG_CATEGORY_LABELS, BUG_STATUS_STYLES, formatBugDate } from "@/lib/bugPresentation";
import BugService from "@/services/BugService";
import { cn } from "@/lib/utils";
import type { BugReport, BugStatus } from "@/types";

const PAGE_SIZE = 10;

interface BugReportListProps {
  /** Whether the list is on screen; it only loads while it is. */
  active: boolean;
  /** `all` asks for everyone's reports — the admin queue. Omit for the caller's own. */
  scope?: 'all';
  /** Narrow to one triage state. */
  status?: BugStatus;
  /** Bumped by the parent after something changes a report, to pull the change in. */
  refreshNonce?: number;
  /** Open one report's thread. */
  onOpen: (id: string) => void;
  /** Shown in place of the list when nothing matches. */
  emptyLabel?: string;
}

/** Paged list of bug reports. Shared by the reporter's own Bugs tab and the Admin Panel's queue, which
 *  differ only in the scope they ask for. */
export function BugReportList({
  active, scope, status, refreshNonce = 0, onOpen, emptyLabel = 'No reports yet.',
}: BugReportListProps) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  // Nothing on screen to dim, so the skeleton is the only thing to show.
  const isFirstLoad = isLoading && reports.length === 0;
  // A reload of rows already on screen: dim them in place instead of collapsing the list and springing
  // it back, which is what swapping in a fixed-height skeleton did.
  const isRefreshing = isLoading && reports.length > 0;

  const load = useCallback(async () => {
    if (!active) return;

    setIsLoading(true);
    try {
      const result = await BugService.list({ page, limit: PAGE_SIZE, scope, status });
      setReports(result.reports);
      setTotal(result.total);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load reports');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [active, page, scope, status]);

  useEffect(() => { load(); }, [load, refreshNonce]);

  // A filter change would otherwise land on whatever page the previous list was showing.
  useEffect(() => { setPage(1); }, [status, scope]);

  if (isFirstLoad) {
    return (
      <div className="space-y-2 py-2">
        {Array(3).fill(0).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <div
        className={`space-y-2 min-w-0 transition-opacity${isRefreshing ? ' opacity-50 pointer-events-none' : ''}`}
        aria-busy={isLoading}
      >
        {reports.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          reports.map((report) => {
            const style = BUG_STATUS_STYLES[report.status];

            return (
              <button
                key={report.id}
                type="button"
                onClick={() => onOpen(report.id)}
                className="flex w-full items-start gap-2 rounded-md border p-3 text-left hover:bg-accent/50 min-w-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{report.title}</span>
                    {/* A dot rather than a count: a thread is read as a whole, so the number of new
                        replies in it is not something the reader acts on differently. */}
                    {report.unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="New replies" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {BUG_CATEGORY_LABELS[report.category]}
                    {scope === 'all' && ` · ${report.reporter.username || 'Unknown'}`}
                    {' · '}{formatBugDate(report.createdAt)}
                  </p>
                </div>
                <span className={cn('px-2 shrink-0 inline-flex text-xs leading-5 font-semibold rounded-full', style.badge)}>
                  {style.label}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Kept mounted through a reload and dimmed with the list, so paging does not make it jump. */}
      {total > PAGE_SIZE && (
        <div
          className={`flex justify-center items-center gap-2 mt-4 transition-opacity${
            isRefreshing ? ' opacity-50 pointer-events-none' : ''
          }`}
        >
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1}>
            Previous
          </Button>
          <span className="px-2 text-sm">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
