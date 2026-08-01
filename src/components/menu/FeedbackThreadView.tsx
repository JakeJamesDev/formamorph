import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ArrowLeft, ChevronUp, Lock, LockOpen, Pencil, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { DIAGNOSTIC_LABELS } from "@/lib/bugDiagnostics";
import { UserAvatar } from "@/components/UserAvatar";
import {
  FEEDBACK_CATEGORY_LABELS, FEEDBACK_STATUS_STYLES, STATUS_OPTIONS, formatFeedbackDate,
} from "@/lib/feedbackPresentation";
import FeedbackService from "@/services/FeedbackService";
import AuthService from "@/services/AuthService";
import { cn } from "@/lib/utils";
import type { BugDiagnostics, FeedbackDetail, FeedbackStatus } from "@/types";

const COMMENT_MAX = 4000;

interface FeedbackThreadViewProps {
  /** The thread to show. */
  threadId: string;
  /** Back to the list this was opened from. */
  onBack: () => void;
  /** Whether the reader is an admin. Admins may reply anywhere, and moderate. */
  isAdmin?: boolean;
  /** Whether to show the triage controls (status, lock, delete). Admin Panel only — an admin who found
   *  the thread through their own profile can answer it, but triage is a queue action. */
  showTriage?: boolean;
  /** Called after anything that changes the list behind this view (a comment, a status, a delete). */
  onChanged?: () => void;
  /** Called after a delete, so the caller can drop back to its list. */
  onDeleted?: () => void;
}

/** The reporter's diagnostics as filed. Read-only wherever it appears, and never on a suggestion. */
function Diagnostics({ diagnostics }: { diagnostics: BugDiagnostics }) {
  const rows = (Object.keys(DIAGNOSTIC_LABELS) as (keyof BugDiagnostics)[])
    .map((key) => [DIAGNOSTIC_LABELS[key], diagnostics[key]] as const)
    .filter(([, value]) => Boolean(value));

  if (!rows.length) return null;

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd className="truncate text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One thread and its conversation, with a box to add to it. Shared by every surface that opens one; they
 * differ in whether triage controls are shown, and the reply box appears only for whoever may write.
 */
export function FeedbackThreadView({
  threadId, onBack, isAdmin = false, showTriage = false, onChanged, onDeleted,
}: FeedbackThreadViewProps) {
  const [detail, setDetail] = useState<FeedbackDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The comment being rewritten, and its draft text. Only one is open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingCommentDelete, setPendingCommentDelete] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  const plainVocab = useMemo(() => plainVocabulary(), []);
  // Author-owned, not admin-owned: moderation stops at rewriting somebody else's words, and the server
  // refuses it either way.
  const myId = String(AuthService.getCurrentUser()?.id ?? '');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setDetail(await FeedbackService.fetchThread(threadId));
      // Reading clears this thread's share of the badge, so the count outside has to be re-read.
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load this');
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
    // `onChanged` is the caller's refresh; depending on it would reload the thread on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim()) return;

    setIsSending(true);
    try {
      const comment = await FeedbackService.comment(threadId, reply.trim());
      setDetail((prev) => (prev ? { ...prev, comments: [...prev.comments, comment] } : prev));
      setReply('');
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to post the comment');
    } finally {
      setIsSending(false);
    }
  };

  const saveEdit = async () => {
    const next = editDraft.trim();
    if (!editingId || !next) return;

    setIsSavingEdit(true);
    try {
      const updated = await FeedbackService.editComment(threadId, editingId, next);
      setDetail((prev) => (prev
        ? { ...prev, comments: prev.comments.map((c) => (c.id === updated.id ? updated : c)) }
        : prev));
      setEditingId(null);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save the comment');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const removeCommentById = async (commentId: string) => {
    try {
      await FeedbackService.removeComment(threadId, commentId);
      setDetail((prev) => (prev
        ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }
        : prev));
      // The edit box would otherwise stay open over a comment that no longer exists.
      if (editingId === commentId) setEditingId(null);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete the comment');
    }
  };

  const changeStatus = async (status: FeedbackStatus) => {
    try {
      const updated = await FeedbackService.setStatus(threadId, status);
      setDetail((prev) => (prev ? { ...prev, thread: updated } : prev));
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update the status');
    }
  };

  const toggleLock = async (locked: boolean) => {
    try {
      const updated = await FeedbackService.setLocked(threadId, locked);
      setDetail((prev) => (prev ? { ...prev, thread: updated } : prev));
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to lock the thread');
    }
  };

  const toggleVote = async () => {
    if (!detail || isVoting) return;

    setIsVoting(true);
    try {
      const updated = await FeedbackService.setVote(threadId, !detail.thread.voted);
      setDetail((prev) => (prev ? { ...prev, thread: updated } : prev));
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to record your vote');
    } finally {
      setIsVoting(false);
    }
  };

  const remove = async () => {
    try {
      await FeedbackService.remove(threadId);
      toast.success('Deleted');
      onChanged?.();
      onDeleted?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete this');
    }
  };

  if (isLoading && !detail) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="py-4 space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <p className="text-sm text-muted-foreground">This could not be loaded.</p>
      </div>
    );
  }

  const { thread, comments } = detail;
  const status = FEEDBACK_STATUS_STYLES[thread.status];
  const isSuggestion = thread.type === 'suggestion';
  // Who may write: an admin anywhere, anyone on an open suggestion, the reporter on their own bug. A lock
  // closes it to everyone but the admins. The server enforces the same rules — this only keeps a box off
  // screen that would be refused.
  const canWrite = isAdmin || (!thread.locked && (isSuggestion || thread.reporter.id === myId));

  /** Why the reply box is absent, in the reader's terms. */
  const closedReason = thread.locked
    ? 'This thread has been locked. It stays here to read.'
    : 'You’re reading somebody else’s report. Replies are between the reporter and the team.';

  return (
    <div className="py-4 space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>

        {showTriage && (
          <div className="flex items-center gap-2">
            <Select value={thread.status} onValueChange={(value) => changeStatus(value as FeedbackStatus)}>
              <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS[thread.type].map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              aria-label={thread.locked ? 'Unlock thread' : 'Lock thread'}
              title={thread.locked ? 'Open it to replies again' : 'Close it to further replies'}
              onClick={() => toggleLock(!thread.locked)}
            >
              {thread.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive/80"
              aria-label="Delete thread"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <section className="space-y-2 rounded-md border p-4 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium">{thread.title}</h3>
          <div className="flex items-center gap-2">
            {thread.locked && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
            <span className={cn('px-2 inline-flex text-xs leading-5 font-semibold rounded-full', status.badge)}>
              {status.label}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {FEEDBACK_CATEGORY_LABELS[thread.category]} · {thread.reporter.username || 'Unknown'} ·{' '}
          {formatFeedbackDate(thread.createdAt)}
        </p>
        <div className="text-sm min-w-0"><MarkdownRenderer text={thread.body} /></div>

        {/* Suggestions only, and votable even when locked: closing a discussion doesn't make the idea
            less wanted. */}
        {isSuggestion && (
          <Button
            variant={thread.voted ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            aria-pressed={thread.voted}
            disabled={isVoting}
            onClick={toggleVote}
          >
            <ChevronUp className="h-4 w-4" />
            {thread.voted ? 'Voted' : 'Vote'} · {thread.votes}
          </Button>
        )}

        <Diagnostics diagnostics={thread.diagnostics} />
      </section>

      <div className="space-y-2 min-w-0">
        {comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          comments.map((comment) => {
            // Admins may remove anyone's comment — the only lever there is when an open thread goes bad
            // — but never rewrite one. A lock closes editing to its author, moderators excepted.
            const mine = comment.author.id === myId;
            const mayEdit = mine && (isAdmin || !thread.locked);
            const mayDelete = mayEdit || isAdmin;

            return (
              <div
                key={comment.id}
                // A reply from the team is tinted so it reads as an answer rather than another thread.
                className={cn(
                  'rounded-md border p-3 min-w-0',
                  comment.author.isAdmin && 'border-primary/40 bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {/* The team signs as the team, so a moderator's own face would be the wrong name's. */}
                    {!comment.author.isAdmin && (
                      <UserAvatar username={comment.author.username} avatarUrl={comment.author.avatarUrl} size="xs" />
                    )}
                    {comment.author.isAdmin ? 'Formamorph Team' : comment.author.username || 'Unknown'}
                    {' · '}{formatFeedbackDate(comment.createdAt)}
                    {/* Said plainly, so the other reader can tell a reply changed after they read it. */}
                    {comment.editedAt && <span className="italic"> · edited</span>}
                  </p>

                  {(mayEdit || mayDelete) && editingId !== comment.id && (
                    <div className="flex shrink-0 items-center">
                      {mayEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Edit comment"
                          onClick={() => { setEditingId(comment.id); setEditDraft(comment.body); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {mayDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive/80"
                          aria-label="Delete comment"
                          onClick={() => setPendingCommentDelete(comment.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {editingId === comment.id ? (
                  <div className="mt-2 space-y-2 min-w-0">
                    <PromptField
                      value={editDraft}
                      onChange={(next) => setEditDraft(next.slice(0, COMMENT_MAX))}
                      vocabulary={plainVocab}
                      markdown
                      ariaLabel="Comment text"
                      className="h-[280px]"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={isSavingEdit || !editDraft.trim()}>
                        {isSavingEdit ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {editDraft.length} / {COMMENT_MAX}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-sm min-w-0"><MarkdownRenderer text={comment.body} /></div>
                )}
              </div>
            );
          })
        )}
      </div>

      {!canWrite ? (
        // The server refuses the post either way, so an empty box here would just be an error waiting
        // to happen.
        <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
          {closedReason}
        </p>
      ) : (
      <div className="space-y-2 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Reply</span>
          <span className="text-xs text-muted-foreground">{reply.length} / {COMMENT_MAX}</span>
        </div>
        <PromptField
          value={reply}
          onChange={(next) => setReply(next.slice(0, COMMENT_MAX))}
          vocabulary={plainVocab}
          markdown
          ariaLabel="Reply"
          placeholder="Add to the thread"
          className="h-[280px]"
        />
        <Button size="sm" onClick={send} disabled={isSending || !reply.trim()}>
          <Send className="mr-2 h-4 w-4" /> {isSending ? 'Sending…' : 'Send Reply'}
        </Button>
      </div>
      )}

      <ConfirmDialog
        open={!!pendingCommentDelete}
        onOpenChange={(isOpen) => { if (!isOpen) setPendingCommentDelete(null); }}
        title="Delete this comment?"
        description="It goes for good, and the rest of the thread stays as it is."
        onConfirm={() => {
          const commentId = pendingCommentDelete;
          setPendingCommentDelete(null);
          if (commentId) void removeCommentById(commentId);
        }}
        onCancel={() => setPendingCommentDelete(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(isOpen) => { if (!isOpen) setConfirmDelete(false); }}
        title="Delete this?"
        description="It and its whole thread go for good. The person who filed it is not told."
        onConfirm={() => { remove(); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
