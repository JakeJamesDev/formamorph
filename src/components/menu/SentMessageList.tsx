import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ChevronDown, Megaphone, Pencil, Pin, Undo2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { MESSAGE_SEVERITY_STYLES, formatMessageDate } from "@/lib/messageSeverity";
import MessageService from "@/services/MessageService";
import { cn } from "@/lib/utils";
import type { SentMessage } from "@/types";

const PAGE_SIZE = 10;

interface SentMessageListProps {
  /** Opens the edit form for a message. Omit to hide the action. */
  onEdit?: (message: SentMessage) => void;
  /** Which half of the sent history to list. Direct messages and broadcasts have separate surfaces. */
  audience: 'direct' | 'broadcast';
  /** Narrows to one user's direct history; ignored for broadcasts. */
  userId?: string;
  /** Bumped by the parent after a send, to pull the new message into an already-open list. */
  refreshNonce?: number;
  /** Shown in place of the list when nothing matches. */
  emptyLabel?: string;
  /** Whether the surface holding this list is on screen; it only fetches while it is. Defaults to on, so
   *  a caller that is only ever mounted when visible needs no flag. */
  active?: boolean;
}

/** Read-state summary for one sent message: one recipient's receipt, or a broadcast's tally. */
function Receipt({ message }: { message: SentMessage }) {
  if (message.broadcast) {
    return <span>Read by {message.readCount ?? 0} of {message.eligibleCount ?? 0}</span>;
  }

  if (!message.recipient) return null;

  if (message.recipient.readAt) {
    return (
      <span>
        Read {formatMessageDate(message.recipient.readAt)}
        {message.recipient.dismissedAt && ', then dismissed'}
      </span>
    );
  }

  return <span>{message.recipient.dismissedAt ? 'Dismissed unread' : 'Unread'}</span>;
}

/**
 * Paged list of sent messages with read receipts and recall. Shared by the Users tab's per-user history
 * and the Broadcasts tab, which differ only by which half of the history they ask for.
 */
export function SentMessageList({ audience, userId, refreshNonce = 0, emptyLabel = 'Nothing sent yet.', onEdit, active = true }: SentMessageListProps) {
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingRecall, setPendingRecall] = useState<SentMessage | null>(null);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  // Nothing on screen to dim, so the skeleton is the only thing to show.
  const isFirstLoad = isLoading && messages.length === 0;
  // A reload of messages already on screen: dim them in place instead of swapping in the skeleton,
  // which is a fixed three rows and collapses a full page of twenty on every page change.
  const isRefreshing = isLoading && messages.length > 0;

  const load = useCallback(async () => {
    if (!active) return;
    setIsLoading(true);

    try {
      const result = await MessageService.fetchSent({ page, limit: PAGE_SIZE, userId, audience });
      setMessages(result.messages);
      setTotal(result.total);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load sent messages');
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, userId, audience, active]);

  useEffect(() => { load(); }, [load, refreshNonce]);

  // A filter change would otherwise land on whatever page the previous list was showing.
  useEffect(() => { setPage(1); }, [userId, audience]);

  const recall = async (message: SentMessage) => {
    try {
      await MessageService.recall(message.id);
      setMessages((prev) => prev.map((m) => (
        m.id === message.id ? { ...m, recalledAt: new Date().toISOString() } : m
      )));
      toast.success('Message recalled');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to recall the message');
    }
  };

  return (
    <>
      <div
        className={`space-y-2 min-w-0 transition-opacity${isRefreshing ? ' opacity-50 pointer-events-none' : ''}`}
        aria-busy={isLoading}
      >
        {isFirstLoad ? (
          Array(3).fill(0).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          messages.map((message) => {
            const style = MESSAGE_SEVERITY_STYLES[message.severity];
            const Icon = style.icon;
            const isExpanded = expandedId === message.id;

            return (
              <div
                key={message.id}
                className={cn('border rounded-md', style.card, message.recalledAt && 'opacity-60')}
              >
                <div className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    className="flex flex-1 items-start gap-2 text-left min-w-0"
                    onClick={() => setExpandedId(isExpanded ? null : message.id)}
                    aria-expanded={isExpanded}
                  >
                    <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', style.accent)} />

                    <span className="flex-1 min-w-0">
                      {/* `min-w-0` on both the row and the text, or a long subject widens the dialog
                          instead of ellipsing — a flex child won't shrink below its content. */}
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn('text-sm truncate min-w-0', message.recalledAt && 'line-through')}
                          title={message.subject}
                        >
                          {message.subject}
                        </span>
                        {message.broadcast && <Megaphone className="h-3 w-3 shrink-0" aria-label="Broadcast" />}
                        {message.scope === 'pinned' && <Pin className="h-3 w-3 shrink-0" aria-label="Pinned" />}
                        {message.scope === 'new' && <Users className="h-3 w-3 shrink-0" aria-label="Also reaches new accounts" />}
                      </span>

                      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{message.broadcast ? 'Everyone' : message.recipient?.username ?? 'Unknown'}</span>
                        <span>·</span>
                        <span>{formatMessageDate(message.createdAt)}</span>
                        {message.editedAt && <span>· Edited {formatMessageDate(message.editedAt)}</span>}
                        <span>·</span>
                        <Receipt message={message} />
                        {message.recalledAt && <span className="text-destructive">· Recalled</span>}
                      </span>
                    </span>

                    <ChevronDown
                      className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')}
                    />
                  </button>

                  {!message.recalledAt && (
                    <div className="flex shrink-0 gap-1">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => onEdit(message)}
                        >
                          <Pencil className="mr-1 h-3 w-3" /> Edit
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive/80"
                        onClick={() => setPendingRecall(message)}
                      >
                        <Undo2 className="mr-1 h-3 w-3" /> Recall
                      </Button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pl-9 text-sm">
                    <MarkdownRenderer text={message.body} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Kept mounted through a reload and dimmed with the list — unmounting it took the whole row out
          of the layout and put it back. */}
      {total > PAGE_SIZE && (
        <div
          className={`flex justify-center items-center gap-2 mt-4 transition-opacity${
            isRefreshing ? ' opacity-50 pointer-events-none' : ''
          }`}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
          >
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

      <ConfirmDialog
        open={pendingRecall !== null}
        onOpenChange={(isOpen) => { if (!isOpen) setPendingRecall(null); }}
        title="Recall this message?"
        description={
          pendingRecall?.broadcast
            ? `"${pendingRecall?.subject}" will disappear from every inbox. It stays on this list.`
            : `"${pendingRecall?.subject}" will disappear from the recipient's inbox. It stays on this list.`
        }
        onConfirm={() => {
          if (pendingRecall) recall(pendingRecall);
          setPendingRecall(null);
        }}
        onCancel={() => setPendingRecall(null)}
      />
    </>
  );
}
