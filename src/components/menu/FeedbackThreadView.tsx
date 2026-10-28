import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronUp, CircleCheck, Lock, LockOpen, Pencil, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackLinkContext, FeedbackMarkdown, type FeedbackLinkPlace } from "@/components/menu/FeedbackMarkdown";
import PromptField from "@/components/prompt/PromptField";
import { FeedbackSuggestPlugin } from "@/components/menu/FeedbackSuggestPlugin";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { DIAGNOSTIC_LABELS } from "@/lib/bugDiagnostics";
import { UserAvatar } from "@/components/UserAvatar";
import { UserName } from "@/components/UserName";
import { FeedbackEditDialog } from "@/components/menu/FeedbackEditDialog";
import { mayEditProse, mayRefile } from "@/lib/feedbackEditing";
import { badgeRole, isStaff } from "@/lib/roles";
import {
  FEEDBACK_CATEGORY_LABELS, SET_STATUS_OPTIONS, STATUS_OPTIONS, formatFeedbackDate, statusStyle,
} from "@/lib/feedbackPresentation";
import FeedbackService from "@/services/FeedbackService";
import AuthService from "@/services/AuthService";
import { cn } from "@/lib/utils";
import {
  isVotableBoard, type BugDiagnostics, type FeedbackComment, type FeedbackDetail, type FeedbackStatus, type FeedbackThread, type FeedbackType,
} from "@/types";
import { DetailedError } from "@/lib/errorDetails";
import { Tip } from "@/components/ui/tooltip";
import { useMountedRef } from "@/lib/useMountedRef";
import { feedbackListingUrl, feedbackProfileUrl, feedbackThreadChipHref } from "@/lib/feedbackLinks";
import { useUserProfile } from "@/contexts/userProfileStore";
import { APP_FEEDBACK_CAPABILITIES, type FeedbackCapabilities, type FeedbackNotify } from "@/lib/feedbackCapabilities";

const COMMENT_MAX = 4000;

interface FeedbackThreadViewProps {
  /** The thread to show, by UUID or number. */
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
  /** Reports each result to the reader. */
  notify: FeedbackNotify;
  /** What this surface may show and do; the app's full set when omitted. */
  capabilities?: FeedbackCapabilities;
  /** Set for a guest: Vote and Reply call it instead of the service. */
  onGuestWrite?: () => void;
  /** Called with each loaded thread. */
  onLoaded?: (thread: FeedbackThread) => void;
  /** Called in place of an error when the thread is gone or not on a board this surface shows. */
  onUnavailable?: () => void;
  /** Opens a linked thread. Without it the link opens in this view. */
  onOpenThread?: (number: number) => void;
  /** The address a thread link carries; the website's by default, and none for a bug. */
  threadHref?: (number: number, type: FeedbackType) => string | undefined;
  /** Opens a linked listing. Without it the app's catalog browser opens it, or the link follows its address. */
  onOpenListing?: (listing: { kind: string; id: string }) => void;
  /** The address a listing link carries; the website's by default. */
  listingHref?: (listing: { kind: string; id: string }) => string;
  /** The address a user link carries; the website's by default. */
  profileHref?: (username: string) => string;
}

/** The reporter's diagnostics as filed. Read-only wherever it appears, and never on a suggestion or question. */
function Diagnostics({ diagnostics }: { diagnostics: BugDiagnostics }) {
  const rows = (Object.keys(DIAGNOSTIC_LABELS) as (keyof BugDiagnostics)[])
    .map((key) => [DIAGNOSTIC_LABELS[key], diagnostics[key]] as const)
    .filter(([, value]) => Boolean(value));

  if (!rows.length) return null;

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-md border bg-muted/40 px-3 py-2 text-meta text-muted-foreground">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd className="truncate text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Who wrote a reply and when. Shared by the thread's replies and the pinned accepted answer. */
function ReplyByline({ comment }: { comment: FeedbackComment }) {
  return (
    <p className="flex items-center gap-1.5 text-meta text-muted-foreground">
      {/* Everyone signs with their own name and face; the badge says who they answer for. */}
      <UserAvatar username={comment.author.username} avatarUrl={comment.author.avatarUrl} supporter={comment.author.supporter} size="xs" />
      <UserName userId={comment.author.id} username={comment.author.username} role={comment.author.role} supporter={comment.author.supporter} />
      {' · '}{formatFeedbackDate(comment.createdAt)}
      {/* Said plainly, so the other reader can tell a reply changed after they read it. */}
      {comment.editedAt && <span className="italic"> · edited</span>}
    </p>
  );
}

/**
 * One thread and its conversation, with a box to add to it. Shared by every surface that opens one; they
 * differ in whether triage controls are shown, and the reply box appears only for whoever may write.
 */
export function FeedbackThreadView(props: FeedbackThreadViewProps) {
  const {
    threadId, capabilities = APP_FEEDBACK_CAPABILITIES, onOpenThread,
    threadHref = feedbackThreadChipHref,
    onOpenListing, listingHref = feedbackListingUrl, profileHref = feedbackProfileUrl,
  } = props;
  const lentListingOpener = useUserProfile().openListing;
  const openListing = onOpenListing ?? lentListingOpener;
  // A thread opened from a link replaces this one until the caller opens another.
  const [linked, setLinked] = useState<{ from: string; id: string } | null>(null);
  const shownId = linked?.from === threadId ? linked.id : threadId;

  const place = useMemo<FeedbackLinkPlace>(() => ({
    boards: capabilities.boards,
    threadHref,
    profileHref,
    openThread: onOpenThread ?? ((number) => setLinked({ from: threadId, id: String(number) })),
    listingHref,
    openListing,
  }), [capabilities.boards, threadHref, profileHref, onOpenThread, threadId, listingHref, openListing]);

  return (
    <FeedbackLinkContext.Provider value={place}>
      {/* Keyed, so a linked thread starts with no draft, edit or vote of the last one. */}
      <ThreadPane key={shownId} {...props} threadId={shownId} />
    </FeedbackLinkContext.Provider>
  );
}

function ThreadPane({
  threadId, onBack, isAdmin: callerIsAdmin = false, showTriage: callerShowsTriage = false, onChanged, onDeleted,
  notify, capabilities = APP_FEEDBACK_CAPABILITIES, onGuestWrite, onLoaded, onUnavailable,
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
  const [editingThread, setEditingThread] = useState(false);
  // The last failed write and the control it belongs to: 'vote', 'reply' or a comment id.
  const [controlNote, setControlNote] = useState<{ at: string; text: string } | null>(null);

  const plainVocab = useMemo(() => plainVocabulary(), []);
  // Author-owned, not admin-owned: moderation stops at rewriting somebody else's words, and the server
  // refuses it either way.
  const account = AuthService.getCurrentUser();
  const myId = String(account?.id ?? '');
  // Without staff controls a staff reader is a player: the account's id alone carries no role.
  const viewer = capabilities.staffControls ? account : (account ? { id: account.id } : null);
  const isAdmin = capabilities.staffControls && callerIsAdmin;
  const showTriage = capabilities.staffControls && callerShowsTriage;

  const mounted = useMountedRef();
  // Only a read takes a number; every write names the thread by its UUID.
  const uuid = detail?.thread.id ?? threadId;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await FeedbackService.fetchThread(threadId);
      if (!mounted.current) return;
      // Never rendered, not even for a moment: a surface without the board does not show its threads.
      if (!capabilities.boards.includes(loaded.thread.type)) {
        setDetail(null);
        onUnavailable?.();
        return;
      }
      setDetail(loaded);
      onLoaded?.(loaded.thread);
      // Reading clears this thread's share of the badge, so the count outside has to be re-read.
      onChanged?.();
    } catch (error) {
      if (!mounted.current) return;
      setDetail(null);
      if (onUnavailable && error instanceof DetailedError && error.status === 404) {
        onUnavailable();
        return;
      }
      notify('Failed to load this', 'error', error);
    } finally {
      if (mounted.current) setIsLoading(false);
    }
    // The callbacks are the caller's and `capabilities` is a module constant; depending on them would reload the thread on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => { load(); }, [load]);

  /** A failed write: under its control where the surface says so. A 401 always goes to `notify`, which owns the session. */
  const fail = (at: string, message: string, error: unknown) => {
    if (capabilities.inlineNotes && !(error instanceof DetailedError && error.status === 401)) {
      setControlNote({ at, text: message });
      return;
    }
    notify(message, 'error', error);
  };
  const noteAt = (at: string) => (controlNote?.at === at
    ? <p role="alert" className="text-helper text-destructive">{controlNote.text}</p>
    : null);

  const send = async () => {
    if (!reply.trim()) return;

    setControlNote(null);
    setIsSending(true);
    try {
      const comment = await FeedbackService.comment(uuid, reply.trim());
      if (!mounted.current) return;
      setDetail((prev) => (prev ? { ...prev, comments: [...prev.comments, comment] } : prev));
      setReply('');
      onChanged?.();
    } catch (error) {
      if (!mounted.current) return;
      fail('reply', 'Failed to post the comment', error);
    } finally {
      if (mounted.current) setIsSending(false);
    }
  };

  const saveEdit = async () => {
    const next = editDraft.trim();
    if (!editingId || !next) return;

    setControlNote(null);
    setIsSavingEdit(true);
    try {
      const updated = await FeedbackService.editComment(uuid, editingId, next);
      if (!mounted.current) return;
      setDetail((prev) => (prev
        ? { ...prev, comments: prev.comments.map((c) => (c.id === updated.id ? updated : c)) }
        : prev));
      setEditingId(null);
      // The pinned copy is a second rendering of this reply; only the server's thread holds the new text.
      if (detail?.thread.acceptedAnswer?.id === updated.id) void load();
    } catch (error) {
      if (!mounted.current) return;
      fail(editingId, 'Failed to save the comment', error);
    } finally {
      if (mounted.current) setIsSavingEdit(false);
    }
  };

  const removeCommentById = async (commentId: string) => {
    setControlNote(null);
    try {
      await FeedbackService.removeComment(uuid, commentId);
      if (!mounted.current) return;
      setDetail((prev) => (prev
        ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }
        : prev));
      // The edit box would otherwise stay open over a comment that no longer exists.
      if (editingId === commentId) setEditingId(null);
      // Deleting the accepted reply reopens the question, so the pin and the status come from the server.
      if (detail?.thread.acceptedAnswer?.id === commentId) void load();
    } catch (error) {
      if (mounted.current) fail(commentId, 'Failed to delete the comment', error);
    }
  };

  const changeStatus = async (status: FeedbackStatus) => {
    try {
      const updated = await FeedbackService.setStatus(uuid, status);
      if (!mounted.current) return;
      setDetail((prev) => (prev ? { ...prev, thread: updated } : prev));
      onChanged?.();
    } catch (error) {
      if (mounted.current) notify('Failed to update the status', 'error', error);
    }
  };

  const setAnswer = async (commentId: string | null) => {
    try {
      const updated = await FeedbackService.setAnswer(uuid, commentId);
      if (!mounted.current) return;
      setDetail((prev) => (prev ? { ...prev, thread: updated } : prev));
      onChanged?.();
    } catch (error) {
      if (mounted.current) notify('Failed to update the answer', 'error', error);
    }
  };

  const toggleLock = async (locked: boolean) => {
    try {
      const updated = await FeedbackService.setLocked(uuid, locked);
      if (!mounted.current) return;
      setDetail((prev) => (prev ? { ...prev, thread: updated } : prev));
      onChanged?.();
    } catch (error) {
      if (mounted.current) notify('Failed to lock the thread', 'error', error);
    }
  };

  const toggleVote = async () => {
    if (onGuestWrite) {
      onGuestWrite();
      return;
    }
    if (!detail || isVoting) return;

    setControlNote(null);
    setIsVoting(true);
    try {
      const updated = await FeedbackService.setVote(uuid, !detail.thread.voted);
      if (!mounted.current) return;
      setDetail((prev) => (prev ? { ...prev, thread: updated } : prev));
      onChanged?.();
    } catch (error) {
      if (!mounted.current) return;
      fail('vote', 'Failed to record your vote', error);
    } finally {
      if (mounted.current) setIsVoting(false);
    }
  };

  const remove = async () => {
    try {
      await FeedbackService.remove(uuid);
      notify('Deleted', 'success');
      onChanged?.();
      onDeleted?.();
    } catch (error) {
      if (mounted.current) notify('Failed to delete this', 'error', error);
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
        <p className="text-helper text-muted-foreground">This could not be loaded.</p>
      </div>
    );
  }

  const { thread, comments } = detail;
  const status = statusStyle(thread.status);
  const votable = isVotableBoard(thread.type);
  // Who owns which part of a report: a bug's words are the team's to make useful, a suggestion's stay
  // its author's, and the filing is triage either way. The server decides the same thing again.
  const canEditProse = mayEditProse(thread, viewer);
  const canRefile = mayRefile(viewer);
  // Who may write: an admin anywhere, anyone on an open votable board, the reporter on their own bug. A lock
  // closes it to everyone but the admins. The server enforces the same rules — this only keeps a box off
  // screen that would be refused.
  const accepted = thread.acceptedAnswer ?? null;
  // The asker and staff choose the answer, on questions only. The server decides the same thing again.
  const canAccept = thread.type === 'question' && (isAdmin || isStaff(viewer) || thread.reporter.id === myId);
  const canWrite = isAdmin || (!thread.locked && (votable || thread.reporter.id === myId));

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
                {/* Every status reads, so the control is never blank; only the ones staff can set are live.
                    A question is Answered by accepting a reply, not from here. */}
                {STATUS_OPTIONS[thread.type].map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={!SET_STATUS_OPTIONS[thread.type].some((settable) => settable.value === option.value)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tip
              tip={thread.locked ? 'Open it to replies again' : 'Close it to further replies'}
              labelsChild={false}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label={thread.locked ? 'Unlock thread' : 'Lock thread'}
                onClick={() => toggleLock(!thread.locked)}
              >
                {thread.locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
            </Tip>
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
          <h3 className="font-medium">
            {thread.title} <span className="font-normal text-muted-foreground">#{thread.number}</span>
          </h3>
          <div className="flex items-center gap-2">
            {thread.locked && (
              <span className="inline-flex items-center gap-1 text-meta text-muted-foreground">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
            <span className={cn('px-2 inline-flex text-meta leading-5 font-semibold rounded-full', status.badge)}>
              {status.label}
            </span>
            {/* Only when there is something this reader may change: an inert control reads as a
                permission they have lost rather than as one they never had. */}
            {(canEditProse || canRefile) && (
              <Tip tip="Edit this report">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditingThread(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </Tip>
            )}
          </div>
        </div>
        <p className="text-meta text-muted-foreground">
          {FEEDBACK_CATEGORY_LABELS[thread.category]} ·{' '}
          <UserName userId={thread.reporter.id} username={thread.reporter.username} role={thread.reporter.role} supporter={thread.reporter.supporter} /> ·{' '}
          {formatFeedbackDate(thread.createdAt)}
          {/* Said plainly: somebody may already have read the earlier wording. */}
          {thread.editedAt && <span className="italic"> · edited</span>}
        </p>
        <div className="text-label min-w-0"><FeedbackMarkdown text={thread.body} targets={thread.targets} /></div>

        {/* Votable boards only, and votable even when locked: closing a discussion doesn't make it less
            wanted. */}
        {votable && (
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
        {noteAt('vote')}

        <Diagnostics diagnostics={thread.diagnostics} />

        {accepted && (
          <div className="space-y-1 rounded-md border border-success/40 bg-success/5 p-3 min-w-0" data-testid="accepted-answer">
            <p className="flex items-center gap-1.5 text-meta font-medium text-success">
              <CircleCheck className="h-3.5 w-3.5" /> Accepted Answer
            </p>
            <ReplyByline comment={accepted} />
            <div className="text-label min-w-0"><FeedbackMarkdown text={accepted.body} targets={accepted.targets} /></div>
          </div>
        )}
      </section>

      <div className="space-y-2 min-w-0">
        {comments.length === 0 ? (
          <p className="py-4 text-center text-helper text-muted-foreground">No replies yet.</p>
        ) : (
          comments.map((comment) => {
            // Admins may remove anyone's comment — the only lever there is when an open thread goes bad
            // — but never rewrite one. A lock closes editing to its author, moderators excepted.
            const mine = comment.author.id === myId;
            const mayEdit = mine && (isAdmin || !thread.locked);
            const mayDelete = mayEdit || isAdmin;
            const isAccepted = accepted?.id === comment.id;

            return (
              <div
                key={comment.id}
                // A reply from the team is tinted so it reads as an answer rather than another thread.
                className={cn(
                  'rounded-md border p-3 min-w-0',
                  badgeRole(comment.author.role) && 'border-primary/40 bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <ReplyByline comment={comment} />
                    {isAccepted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 text-meta font-semibold leading-5 text-success">
                        <Check className="h-3 w-3" /> Accepted
                      </span>
                    )}
                  </div>

                  {canAccept && editingId !== comment.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-meta"
                      onClick={() => setAnswer(isAccepted ? null : comment.id)}
                    >
                      {isAccepted ? 'Clear Answer' : 'Accept Answer'}
                    </Button>
                  )}

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
                    >
                      <FeedbackSuggestPlugin thread={thread.id} threadTypes={capabilities.threadSearchTypes} />
                    </PromptField>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={isSavingEdit || !editDraft.trim()}>
                        {isSavingEdit ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <X className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                      <span className="ml-auto text-meta text-muted-foreground">
                        {editDraft.length} / {COMMENT_MAX}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-label min-w-0"><FeedbackMarkdown text={comment.body} targets={comment.targets} /></div>
                )}
                {noteAt(comment.id)}
              </div>
            );
          })
        )}
      </div>

      {onGuestWrite && votable && !thread.locked ? (
        <Button size="sm" onClick={onGuestWrite}>
          <Send className="mr-2 h-4 w-4" /> Sign In to Reply
        </Button>
      ) : !canWrite ? (
        // The server refuses the post either way, so an empty box here would just be an error waiting
        // to happen.
        <p className="rounded-md border border-dashed p-3 text-center text-helper text-muted-foreground">
          {closedReason}
        </p>
      ) : (
      <div className="space-y-2 min-w-0">
        <div className="flex items-baseline justify-between">
          <span className="text-label font-medium">Reply</span>
          <span className="text-meta text-muted-foreground">{reply.length} / {COMMENT_MAX}</span>
        </div>
        <PromptField
          value={reply}
          onChange={(next) => setReply(next.slice(0, COMMENT_MAX))}
          vocabulary={plainVocab}
          markdown
          ariaLabel="Reply"
          placeholder="Add to the thread"
          className="h-[280px]"
        >
          <FeedbackSuggestPlugin thread={thread.id} threadTypes={capabilities.threadSearchTypes} />
        </PromptField>
        <Button size="sm" onClick={send} disabled={isSending || !reply.trim()}>
          <Send className="mr-2 h-4 w-4" /> {isSending ? 'Sending…' : 'Send Reply'}
        </Button>
        {noteAt('reply')}
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

      <FeedbackEditDialog
        open={editingThread}
        onOpenChange={setEditingThread}
        thread={thread}
        mayEditProse={canEditProse}
        mayRefile={canRefile}
        notify={notify}
        inlineNote={capabilities.inlineNotes}
        threadSearchTypes={capabilities.threadSearchTypes}
        onSaved={(saved) => {
          // Written in rather than refetched, so a type move's new status and cleared diagnostics land
          // at once; the list behind it is told separately.
          setDetail((prev) => (prev ? { ...prev, thread: saved } : prev));
          onChanged?.();
          // A type change clears the accepted answer on the server; the pin must follow.
          if (saved.type !== thread.type) void load();
        }}
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
