import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ChevronDown, Inbox, Megaphone, Pin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { MESSAGE_SEVERITY_STYLES, formatMessageDate } from "@/lib/messageSeverity";
import MessageService from "@/services/MessageService";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "@/types";

interface MessagesTabProps {
  /** Whether the tab is mounted and visible; a fresh fetch runs each time this turns true. */
  active: boolean;
  /** Reports the unread count after every load or state change, so the footer badge stays in step. */
  onUnreadChange?: (unread: number) => void;
}

/** Notices from the administrators. Read-only: there is no reply channel, by design. */
export function MessagesTab({ active, onUnreadChange }: MessagesTabProps) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Everything visible on the server, which is more than the page holds once the limit bites.
  const [total, setTotal] = useState(0);

  const publishUnread = useCallback((list: InboxMessage[]) => {
    onUnreadChange?.(list.filter((message) => !message.readAt).length);
  }, [onUnreadChange]);

  useEffect(() => {
    if (!active) return;

    let current = true;
    setIsLoading(true);
    setLoadError('');

    MessageService.fetchInbox()
      .then((result) => {
        if (!current) return;
        setMessages(result.messages);
        setTotal(result.total);
        onUnreadChange?.(result.unread);
      })
      .catch((error: unknown) => {
        // Inline rather than a toast: the server being unreachable is the common case here, and a
        // toast for it would fire every time the dialog opens offline.
        if (current) setLoadError((error as Error).message || 'Failed to load messages');
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    return () => { current = false; };
    // `onUnreadChange` is deliberately not a dependency — a parent passing an inline callback would
    // otherwise refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  /** Open a message, marking it read the first time. A failed mark leaves it unread to retry. */
  const toggle = async (message: InboxMessage) => {
    const opening = expandedId !== message.id;
    setExpandedId(opening ? message.id : null);

    if (!opening || message.readAt) return;

    try {
      await MessageService.markRead(message.id);
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === message.id ? { ...m, readAt: new Date().toISOString() } : m));
        publishUnread(next);
        return next;
      });
    } catch (error) {
      console.error('Failed to mark message read:', error);
    }
  };

  const dismiss = async (message: InboxMessage) => {
    try {
      await MessageService.dismiss(message.id);

      // Truncated: dismissing frees a slot, so pull the next one in rather than leaving a list that
      // says "showing 50 of 63" and shrinks to 49.
      if (total > messages.length) {
        const result = await MessageService.fetchInbox();
        setMessages(result.messages);
        setTotal(result.total);
        onUnreadChange?.(result.unread);
        return;
      }

      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== message.id);
        publishUnread(next);
        return next;
      });
      setTotal((prev) => Math.max(prev - 1, 0));
    } catch (error) {
      toast.error((error as Error).message || 'Failed to dismiss the message');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {Array(3).fill(0).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <p>{loadError}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">No messages.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-4">
      {/* The fetch is capped, so say so rather than letting the oldest quietly not exist. */}
      {total > messages.length && (
        <p className="pb-1 text-xs text-muted-foreground">
          Showing {messages.length} of {total}. Dismiss one and the next appears.
        </p>
      )}

      {messages.map((message) => {
        const style = MESSAGE_SEVERITY_STYLES[message.severity];
        const Icon = style.icon;
        const isExpanded = expandedId === message.id;

        return (
          <div key={message.id} className={cn('border rounded-md', style.card)}>
            <div className="flex items-start gap-2 p-3">
              <button
                type="button"
                className="flex flex-1 items-start gap-2 text-left min-w-0"
                onClick={() => toggle(message)}
                aria-expanded={isExpanded}
              >
                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', style.accent)} />

                <span className="flex-1 min-w-0">
                  {/* `truncate` only clips once the flex item is allowed to shrink — a flex child's
                      min-width defaults to its content, so without `min-w-0` on both the row and the
                      text a long subject widens the dialog instead of ellipsing. */}
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn('text-sm truncate min-w-0', message.readAt ? 'font-normal' : 'font-semibold')}
                      title={message.subject}
                    >
                      {message.subject}
                    </span>
                    {!message.readAt && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
                    )}
                  </span>

                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="truncate min-w-0">{message.senderAs === 'username' && message.senderName ? message.senderName : 'Formamorph Team'}</span>
                    <span>·</span>
                    <span>{formatMessageDate(message.createdAt)}</span>
                    {message.editedAt && (
                      <span title={`Edited ${formatMessageDate(message.editedAt)}`}>
                        · Edited {formatMessageDate(message.editedAt)}
                      </span>
                    )}
                    {message.broadcast && (
                      <Megaphone className="h-3 w-3 shrink-0" aria-label="Sent to everyone" />
                    )}
                  </span>
                </span>

                <ChevronDown
                  className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')}
                />
              </button>

              {message.scope === 'pinned' ? (
                <span
                  className="h-7 w-7 shrink-0 flex items-center justify-center text-muted-foreground"
                  title="Kept by an administrator — this can't be dismissed"
                  aria-label="Pinned by an administrator"
                >
                  <Pin className="h-4 w-4" />
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => dismiss(message)}
                  aria-label={`Dismiss ${message.subject}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isExpanded && (
              <div className="px-3 pb-3 pl-9 text-sm">
                <MarkdownRenderer text={message.body} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
