import { useCallback, useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Meta } from "@/components/ui/typography";
import { RoleBadge } from "@/components/RoleBadge";
import { KIND_LABELS, type CatalogKind } from "@/lib/catalogKinds";
import { formatServerDateTime } from "@/lib/serverDate";
import { toastError } from "@/lib/linkToast";
import { useMountedRef } from "@/lib/useMountedRef";
import { cn } from "@/lib/utils";
import ReviewService, { type AutoApproval } from "@/services/ReviewService";

const PAGE_SIZE = 20;

interface AutoApprovedTabProps {
  /** Whether the tab is visible; the list only fetches while it is. */
  active: boolean;
  /** Opens a listing in Community Creations. Absent hides Open Listing. */
  onOpenListing?: (listingId: string) => void;
}

/** The noun a row's kind reads as. The snapshot's kind may be a kind this build does not know. */
const nounOf = (entry: AutoApproval) => KIND_LABELS[entry.targetKind as CatalogKind]?.one ?? 'Listing';

/**
 * Admin Panel → Moderation → Auto-Approved. Recent uploads that skipped review because the author is
 * staff or trusted, newest first, so a mod can spot-check them.
 */
export function AutoApprovedTab({ active, onOpenListing }: AutoApprovedTabProps) {
  const [entries, setEntries] = useState<AutoApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  // A failed read must not read as an empty list.
  const [failed, setFailed] = useState(false);
  const mounted = useMountedRef();

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const load = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
      const result = await ReviewService.fetchAutoApproved({ page, limit: PAGE_SIZE, signal });
      if (!mounted.current || signal.aborted) return;
      setEntries(result.entries);
      setTotal(result.total);
      setFailed(false);
    } catch (error) {
      if (!mounted.current || signal.aborted) return;
      setFailed(true);
      toastError(error, 'Failed to load the auto-approvals');
    } finally {
      if (mounted.current && !signal.aborted) setIsLoading(false);
    }
  }, [page, mounted]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [active, load]);

  if (isLoading && entries.length === 0) {
    return (
      <div className="py-4 space-y-2">
        {[0, 1, 2].map((row) => <Skeleton key={row} className="h-14 w-full" />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-helper text-muted-foreground">
        <ShieldCheck className="mx-auto mb-2 h-6 w-6 opacity-50" />
        {failed ? 'The auto-approvals didn’t load' : 'No auto-approvals yet'}
      </div>
    );
  }

  return (
    <div className={cn("py-4 space-y-2 min-w-0", isLoading && "opacity-60")}>
      <Meta as="p">Uploads that skipped review because the author is staff or trusted</Meta>

      <ul className="space-y-2" aria-label="Auto-Approved">
        {entries.map((entry) => {
          const listingId = entry.targetId;

          return (
          <li key={entry.id} className="rounded-lg border border-border p-3 min-w-0">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <h3 className="text-label font-semibold truncate">
                {nounOf(entry)}: {entry.targetName ?? 'Unnamed'}
              </h3>
              {onOpenListing && listingId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 gap-1.5 px-2"
                  onClick={() => onOpenListing(listingId)}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Listing
                </Button>
              )}
            </div>
            <Meta as="p">
              by {entry.actor.username ?? 'Deleted account'}
              <RoleBadge role={entry.actor.role} className="ml-1 align-[0.05em]" />
              {' · '}{formatServerDateTime(entry.createdAt)}
            </Meta>
          </li>
          );
        })}
      </ul>

      {total > PAGE_SIZE && (
        <div className="flex justify-center items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1 || isLoading}>
            Previous
          </Button>
          <span className="px-2 text-label">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(p + 1, totalPages))} disabled={page >= totalPages || isLoading}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
