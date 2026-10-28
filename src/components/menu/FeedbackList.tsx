import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, Lock, MessageSquare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UnreadDot } from "@/components/UnreadDot";
import { UnreadEdge } from "@/components/UnreadEdge";
import { RoleBadge } from "@/components/RoleBadge";
import {
  FEEDBACK_CATEGORY_LABELS, formatFeedbackDate, statusStyle,
} from "@/lib/feedbackPresentation";
import FeedbackService from "@/services/FeedbackService";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/typography";
import { DetailedError } from "@/lib/errorDetails";
import { APP_FEEDBACK_CAPABILITIES, type FeedbackCapabilities, type FeedbackNotify } from "@/lib/feedbackCapabilities";
import { isVotableBoard, type FeedbackCategory, type FeedbackStatus, type FeedbackThread, type FeedbackType } from "@/types";

const PAGE_SIZE = 10;

interface FeedbackListProps {
  /** Whether the list is on screen; it only loads while it is. */
  active: boolean;
  /** Which branch of the tree to list. */
  type: FeedbackType;
  /** `all` asks for everyone's — the admin queue, and the public board. Omit for the caller's own. */
  scope?: 'all';
  /** Narrow to one triage state, or to a set of them. */
  status?: FeedbackStatus | FeedbackStatus[];
  /** Narrow to one area of the app. */
  category?: FeedbackCategory;
  /** How to order the list. The server's default is newest first. */
  sort?: string;
  /** Narrow to threads whose title or body holds this text. */
  search?: string;
  /** The page on screen, 1-based. The parent owns it, so it outlives an open thread. */
  page: number;
  /** Asks the parent for another page: the pager, or a page past the end after a reload. */
  onPageChange: (page: number) => void;
  /** Bumped by the parent after something changes a thread, to pull the change in. */
  refreshNonce?: number;
  /** Open one thread. */
  onOpen: (id: string, number: number) => void;
  /** Shown in place of the list when nothing matches. */
  emptyLabel?: string;
  /** Reports each result to the reader. */
  notify: FeedbackNotify;
  /** What this surface may show and do; the app's full set when omitted. */
  capabilities?: FeedbackCapabilities;
  /** Set for a guest: Vote calls it instead of the service. */
  onGuestWrite?: () => void;
}

/**
 * Paged list of feedback threads. Shared by every surface that lists them — the reporter's own tabs, the
 * public suggestion board and the Admin Panel's queues — which differ only in what they ask for.
 */
export function FeedbackList({
  active, type, scope, status, category, sort, search, page, onPageChange, refreshNonce = 0, onOpen,
  emptyLabel = 'Nothing here yet.', notify, capabilities = APP_FEEDBACK_CAPABILITIES, onGuestWrite,
}: FeedbackListProps) {
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  // The last load failed, so the list says so rather than calling the board empty.
  const [failed, setFailed] = useState(false);
  // Read through a ref so a caller's inline handler does not rebuild the load and refetch every render.
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  // Ids with a vote in flight, so a double click can't send two of the same request.
  const [voting, setVoting] = useState<Set<string>>(new Set());
  // The last failed vote, said under its row where the surface shows notes inline.
  const [voteNote, setVoteNote] = useState<{ id: string; text: string } | null>(null);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  // Nothing on screen to dim, so the skeleton is the only thing to show.
  const isFirstLoad = isLoading && threads.length === 0;
  // A reload of rows already on screen: dim them in place instead of collapsing the list and springing
  // it back, which is what swapping in a fixed-height skeleton did.
  const isRefreshing = isLoading && threads.length > 0;

  // The filter as a plain string, so a caller passing a fresh array each render cannot make every
  // render look like a filter change and refetch forever. The request is rebuilt from it.
  const statusKey = Array.isArray(status) ? status.join(',') : status ?? '';

  // `isCurrent` turns false when the list unmounts or a newer load replaces this one, so a late answer
  // sets no state and an older filter's rows never land over a newer one's.
  const load = useCallback(async (isCurrent: () => boolean) => {
    if (!active) {
      // The load this one replaces no longer clears the flag for itself.
      setIsLoading(false);
      return;
    }

    const asked = statusKey ? (statusKey.split(',') as FeedbackStatus[]) : [];
    const statusArg = asked.length > 1 ? asked : asked[0];

    setIsLoading(true);
    setVoteNote(null);
    try {
      const result = await FeedbackService.list({
        type, page, limit: PAGE_SIZE, scope, status: statusArg, category, sort, search,
      });
      if (!isCurrent()) return;
      // Triage can move the last rows out from under the page. Land on the last page that remains, and
      // keep the old rows until it loads rather than flashing the empty label.
      const lastPage = Math.max(Math.ceil(result.total / PAGE_SIZE), 1);
      if (page > lastPage) {
        onPageChangeRef.current(lastPage);
        return;
      }
      setThreads(result.threads);
      setTotal(result.total);
      setFailed(false);
    } catch (error) {
      if (!isCurrent()) return;
      notifyRef.current('Failed to load these', 'error', error);
      setThreads([]);
      setTotal(0);
      setFailed(true);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [active, type, page, scope, statusKey, category, sort, search]);

  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load, refreshNonce, retryNonce]);

  // A vote outlives no filter change, only the list itself, so it needs the mount and not a per-load flag.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const toggleVote = async (thread: FeedbackThread) => {
    if (onGuestWrite) {
      onGuestWrite();
      return;
    }
    if (voting.has(thread.id)) return;

    setVoting((prev) => new Set(prev).add(thread.id));
    setVoteNote((prev) => (prev?.id === thread.id ? null : prev));
    try {
      const updated = await FeedbackService.setVote(thread.id, !thread.voted);
      if (!mountedRef.current) return;
      // Patched in place rather than reloading: re-sorting the board under a click would move the row
      // out from under the pointer.
      setThreads((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    } catch (error) {
      const message = 'Failed to record your vote';
      // A 401 always goes to `notify`, which owns the session.
      if (capabilities.inlineNotes && !(error instanceof DetailedError && error.status === 401)) {
        if (mountedRef.current) setVoteNote({ id: thread.id, text: message });
      } else {
        // Still said after an unmount: the vote failed whether or not the list is there to show it.
        notify(message, 'error', error);
      }
    } finally {
      if (mountedRef.current) setVoting((prev) => {
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
        {failed ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-helper text-muted-foreground">Formamorph couldn’t load these threads.</p>
            <Button variant="outline" size="sm" onClick={() => setRetryNonce((n) => n + 1)}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden /> Try Again
            </Button>
          </div>
        ) : threads.length === 0 ? (
          <p className="py-8 text-center text-helper text-muted-foreground">{emptyLabel}</p>
        ) : (
          threads.map((thread) => {
            const style = statusStyle(thread.status);
            // Absent from a server that predates the count, which is not the same as a thread with none.
            const replies = thread.commentCount ?? 0;
            const unread = capabilities.unreadBadge && thread.unread;

            return (
              <div key={thread.id} className="min-w-0">
                <div className="relative flex items-stretch gap-2 rounded-md border min-w-0">
                  {unread && <UnreadEdge kind="feedback" />}
                  {/* Votable boards only. A bug is not a popularity contest — one person hitting it is
                      reason enough to fix it. */}
                  {isVotableBoard(thread.type) && (
                    <Button
                      variant="ghost"
                      className={cn(
                        'h-auto shrink-0 flex-col gap-0 rounded-r-none border-r px-3 py-2',
                        // Weight and fill move with the tint rather than the tint alone: on a light theme
                        // --primary is a pale mint against a near-white card, so a color change by itself
                        // was invisible in the list even though the thread it opens said Voted plainly.
                        thread.voted && 'text-primary'
                      )}
                      aria-label={thread.voted ? `Remove your vote for ${thread.title}` : `Vote for ${thread.title}`}
                      aria-pressed={thread.voted}
                      disabled={voting.has(thread.id)}
                      onClick={() => toggleVote(thread)}
                    >
                      {/* Filled once it is yours: the outline chevron closes into a solid arrowhead, which
                          reads at a glance down a column of rows in a way a hue change does not. */}
                      <ChevronUp className={cn('h-4 w-4', thread.voted && 'fill-current')} />
                      <span className={cn('text-meta tabular-nums', thread.voted && 'font-bold')}>{thread.votes}</span>
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpen(thread.id, thread.number)}
                    className="flex flex-1 items-start gap-2 p-3 text-left hover:bg-accent/50 min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-2 text-label">
                        {/* Weight as well as the dot, the way the inbox does it: color alone excludes
                            anybody whose vision does not separate these hues. */}
                        <span className={cn('truncate', unread ? 'font-semibold' : 'font-medium')}>
                          {thread.title}
                        </span>
                        {/* A dot rather than a count: a thread is read as a whole, so the number of new
                            replies in it is not something the reader acts on differently. */}
                        {unread && (
                          <UnreadDot label="New replies" kind="feedback" />
                        )}
                        {thread.locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Locked" />}
                      </p>
                      <p className="text-meta text-muted-foreground truncate">
                        #{thread.number} · {FEEDBACK_CATEGORY_LABELS[thread.category]}
                        {scope === 'all' && (
                          <>
                            {' · '}{thread.reporter.username || 'Unknown'}
                            {/* The badge alone, not `UserName`: the whole row is already a button that opens
                                the thread, and a name-button inside it would be a button within a button. */}
                            <RoleBadge role={thread.reporter.role} className="ml-1 align-middle" />
                          </>
                        )}
                        {' · '}{formatFeedbackDate(thread.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 flex flex-col items-end gap-1">
                      <span className={cn('px-2 inline-flex text-meta leading-5 font-semibold rounded-full', style.badge)}>
                        {style.label}
                      </span>
                      {/* Hidden at zero: the point of the number is that there is activity, and a column
                          of "0" beside every untouched row says only that the feature exists. */}
                      {replies > 0 && (
                        <span
                          className="inline-flex items-center gap-1 pr-0.5 text-meta text-muted-foreground"
                          aria-label={replies === 1 ? '1 reply' : `${replies} replies`}
                        >
                          <MessageSquare className="h-3 w-3" aria-hidden="true" />
                          <span className="tabular-nums">{replies}</span>
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              {voteNote?.id === thread.id && (
                <FieldError role="alert" className="mt-1">{voteNote.text}</FieldError>
              )}
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
          <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(page - 1, 1))} disabled={page <= 1}>
            Previous
          </Button>
          <span className="px-2 text-label">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
