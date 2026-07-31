import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ChevronUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FEEDBACK_CATEGORY_LABELS, FEEDBACK_STATUS_STYLES, formatFeedbackDate,
} from "@/lib/feedbackPresentation";
import FeedbackService from "@/services/FeedbackService";
import { cn } from "@/lib/utils";
import type { FeedbackStatus, FeedbackThread, FeedbackType } from "@/types";

const PAGE_SIZE = 10;

interface FeedbackListProps {
  /** Whether the list is on screen; it only loads while it is. */
  active: boolean;
  /** Which branch of the tree to list. */
  type: FeedbackType;
  /** `all` asks for everyone's — the admin queue, and the public board. Omit for the caller's own. */
  scope?: 'all';
  /** Narrow to one triage state. */
  status?: FeedbackStatus;
  /** How to order the list. The server's default is newest first. */
  sort?: string;
  /** Bumped by the parent after something changes a thread, to pull the change in. */
  refreshNonce?: number;
  /** Open one thread. */
  onOpen: (id: string) => void;
  /** Shown in place of the list when nothing matches. */
  emptyLabel?: string;
}

/**
 * Paged list of feedback threads. Shared by every surface that lists them — the reporter's own tabs, the
 * public suggestion board and the Admin Panel's queues — which differ only in what they ask for.
 */
export function FeedbackList({
  active, type, scope, status, sort, refreshNonce = 0, onOpen, emptyLabel = 'Nothing here yet.',
}: FeedbackListProps) {
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  // Ids with a vote in flight, so a double click can't send two of the same request.
  const [voting, setVoting] = useState<Set<string>>(new Set());

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  // Nothing on screen to dim, so the skeleton is the only thing to show.
  const isFirstLoad = isLoading && threads.length === 0;
  // A reload of rows already on screen: dim them in place instead of collapsing the list and springing
  // it back, which is what swapping in a fixed-height skeleton did.
  const isRefreshing = isLoading && threads.length > 0;

  const load = useCallback(async () => {
    if (!active) return;

    setIsLoading(true);
    try {
      const result = await FeedbackService.list({ type, page, limit: PAGE_SIZE, scope, status, sort });
      setThreads(result.threads);
      setTotal(result.total);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load these');
      setThreads([]);
    } finally {
      setIsLoading(false);
    }
  }, [active, type, page, scope, status, sort]);

  useEffect(() => { load(); }, [load, refreshNonce]);

  // A filter change would otherwise land on whatever page the previous list was showing.
  useEffect(() => { setPage(1); }, [type, status, scope, sort]);

  const toggleVote = async (thread: FeedbackThread) => {
    if (voting.has(thread.id)) return;

    setVoting((prev) => new Set(prev).add(thread.id));
    try {
      const updated = await FeedbackService.setVote(thread.id, !thread.voted);
      // Patched in place rather than reloading: re-sorting the board under a click would move the row
      // out from under the pointer.
      setThreads((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    } catch (error) {
      toast.error((error as Error).message || 'Failed to record your vote');
    } finally {
      setVoting((prev) => {
        const next = new Set(prev);
        next.delete(thread.id);
        return next;
      });
    }
  };

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
        {threads.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          threads.map((thread) => {
            const style = FEEDBACK_STATUS_STYLES[thread.status];

            return (
              <div key={thread.id} className="flex items-stretch gap-2 rounded-md border min-w-0">
                {/* Suggestions only. A bug is not a popularity contest — one person hitting it is
                    reason enough to fix it. */}
                {thread.type === 'suggestion' && (
                  <Button
                    variant="ghost"
                    className={cn(
                      'h-auto shrink-0 flex-col gap-0 rounded-r-none border-r px-3 py-2',
                      thread.voted && 'text-primary'
                    )}
                    aria-label={thread.voted ? `Remove your vote for ${thread.title}` : `Vote for ${thread.title}`}
                    aria-pressed={thread.voted}
                    disabled={voting.has(thread.id)}
                    onClick={() => toggleVote(thread)}
                  >
                    <ChevronUp className="h-4 w-4" />
                    <span className="text-xs tabular-nums">{thread.votes}</span>
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => onOpen(thread.id)}
                  className="flex flex-1 items-start gap-2 p-3 text-left hover:bg-accent/50 min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span className="truncate">{thread.title}</span>
                      {/* A dot rather than a count: a thread is read as a whole, so the number of new
                          replies in it is not something the reader acts on differently. */}
                      {thread.unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="New replies" />
                      )}
                      {thread.locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Locked" />}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {FEEDBACK_CATEGORY_LABELS[thread.category]}
                      {scope === 'all' && ` · ${thread.reporter.username || 'Unknown'}`}
                      {' · '}{formatFeedbackDate(thread.createdAt)}
                    </p>
                  </div>
                  <span className={cn('px-2 shrink-0 inline-flex text-xs leading-5 font-semibold rounded-full', style.badge)}>
                    {style.label}
                  </span>
                </button>
              </div>
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
