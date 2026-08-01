import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ANY_ACTION, AUDIT_ACTION_LABELS, AUDIT_ACTION_OPTIONS, AUDIT_ACTION_STYLES,
  actionFilterValue, describeAuditEntry, formatAuditDate,
} from "@/lib/auditPresentation";
import AuditService from "@/services/AuditService";
import { cn } from "@/lib/utils";
import type { AuditAction, AuditEntry } from "@/types";

const PAGE_SIZE = 20;

interface AuditLogTabProps {
  /** Whether the tab is visible; the log only loads while it is. */
  active: boolean;
}

/**
 * Admin Panel → Log. What was done to accounts and to published work, newest first.
 *
 * Read-only: entries are written by the server from inside the actions they record, and there is nothing
 * here to edit or clear one — a record somebody can rewrite is not a record.
 */
export function AuditLogTab({ active }: AuditLogTabProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState<AuditAction | typeof ANY_ACTION>(ANY_ACTION);
  // What is typed, and what has been submitted — searching on every keystroke would fetch per letter.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  // Nothing on screen to dim, so the skeleton is the only thing to show.
  const isFirstLoad = isLoading && entries.length === 0;
  // A reload of rows already on screen: dim them in place instead of collapsing the list and springing
  // it back, which is what swapping in a fixed-height skeleton does.
  const isRefreshing = isLoading && entries.length > 0;

  const load = useCallback(async () => {
    if (!active) return;

    setIsLoading(true);
    try {
      const result = await AuditService.list({
        page,
        limit: PAGE_SIZE,
        action: actionFilterValue(action),
        search,
      });
      setEntries(result.entries);
      setTotal(result.total);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load the log');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [active, page, action, search]);

  useEffect(() => { load(); }, [load]);

  // A filter change would otherwise land on whatever page the previous list was showing.
  useEffect(() => { setPage(1); }, [action, search]);

  return (
    <div className="py-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-muted-foreground">
          What was done to accounts and to published work. Entries are kept for good and cannot be edited.
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Who or what"
              aria-label="Search the log"
              className="w-40"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <Select value={action} onValueChange={(value) => setAction(value as AuditAction | typeof ANY_ACTION)}>
            <SelectTrigger className="w-44" aria-label="Filter by action"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_ACTION}>All actions</SelectItem>
              {AUDIT_ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isFirstLoad ? (
        <div className="space-y-2 py-2">
          {Array(5).fill(0).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
        </div>
      ) : (
        <div
          className={`space-y-2 min-w-0 transition-opacity${isRefreshing ? ' opacity-50 pointer-events-none' : ''}`}
          aria-busy={isLoading}
        >
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search || action !== ANY_ACTION ? 'Nothing matches this filter.' : 'Nothing has been recorded yet.'}
            </p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm min-w-0">{describeAuditEntry(entry)}</p>
                  <span className={cn(
                    'px-2 shrink-0 inline-flex text-xs leading-5 font-semibold rounded-full',
                    AUDIT_ACTION_STYLES[entry.action],
                  )}>
                    {AUDIT_ACTION_LABELS[entry.action]}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{formatAuditDate(entry.createdAt)}</p>

                {/* What was removed, as far as it was kept. Quoted so it reads as somebody's words rather
                    than as the log's own. */}
                {entry.snippet && (
                  <p className="mt-1 border-l-2 pl-2 text-xs text-muted-foreground italic break-words">
                    {entry.snippet}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

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
    </div>
  );
}
