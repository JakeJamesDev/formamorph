import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ArrowLeft, Pencil, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { DIAGNOSTIC_LABELS } from "@/lib/bugDiagnostics";
import {
  BUG_CATEGORY_LABELS, BUG_STATUS_OPTIONS, BUG_STATUS_STYLES, formatBugDate,
} from "@/lib/bugPresentation";
import BugService from "@/services/BugService";
import AuthService from "@/services/AuthService";
import { cn } from "@/lib/utils";
import type { BugDiagnostics, BugStatus, BugThread } from "@/types";

const COMMENT_MAX = 4000;

interface BugThreadViewProps {
  reportId: string;
  /** Back to the list this was opened from. */
  onBack: () => void;
  /** Admin surfaces get the status control and delete; the reporter's own view does not. */
  isAdmin?: boolean;
  /** Called after anything that changes the list behind this view (a comment, a status, a delete). */
  onChanged?: () => void;
  /** Called after a delete, so the caller can drop back to its list. */
  onDeleted?: () => void;
}

/** The reporter's diagnostics as filed. Read-only wherever it appears. */
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

/** One report and its conversation, with a box to add to it. Shared by the reporter's Bugs tab and the
 *  Admin Panel's queue — they differ only in whether triage controls are shown. */
export function BugThreadView({ reportId, onBack, isAdmin = false, onChanged, onDeleted }: BugThreadViewProps) {
  const [thread, setThread] = useState<BugThread | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The comment being rewritten, and its draft text. Only one is open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingCommentDelete, setPendingCommentDelete] = useState<string | null>(null);

  const plainVocab = useMemo(() => plainVocabulary(), []);
  // Author-owned, not admin-owned: triage powers stop at rewriting somebody else's words, and the server
  // refuses it either way.
  const myId = String(AuthService.getCurrentUser()?.id ?? '');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setThread(await BugService.fetchThread(reportId));
      // Reading clears this thread's share of the badge, so the count outside has to be re-read.
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load the report');
      setThread(null);
    } finally {
      setIsLoading(false);
    }
    // `onChanged` is the caller's refresh; depending on it would reload the thread on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim()) return;

    setIsSending(true);
    try {
      const comment = await BugService.comment(reportId, reply.trim());
      setThread((prev) => (prev ? { ...prev, comments: [...prev.comments, comment] } : prev));
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
      const updated = await BugService.editComment(reportId, editingId, next);
      setThread((prev) => (prev
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
      await BugService.removeComment(reportId, commentId);
      setThread((prev) => (prev
        ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }
        : prev));
      // The edit box would otherwise stay open over a comment that no longer exists.
      if (editingId === commentId) setEditingId(null);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete the comment');
    }
  };

  const changeStatus = async (status: BugStatus) => {
    try {
      const report = await BugService.setStatus(reportId, status);
      setThread((prev) => (prev ? { ...prev, report } : prev));
      onChanged?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update the status');
    }
  };

  const remove = async () => {
    try {
      await BugService.remove(reportId);
      toast.success('Report deleted');
      onChanged?.();
      onDeleted?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to delete the report');
    }
  };

  if (isLoading && !thread) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="py-4 space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
        <p className="text-sm text-muted-foreground">This report could not be loaded.</p>
      </div>
    );
  }

  const { report, comments } = thread;
  const status = BUG_STATUS_STYLES[report.status];
  // Anyone signed in can read a report; only the reporter and the team write in it. The server enforces
  // the same split — this only keeps a box off screen that would be refused.
  const canWrite = isAdmin || report.reporter.id === myId;

  return (
    <div className="py-4 space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Select value={report.status} onValueChange={(value) => changeStatus(value as BugStatus)}>
              <SelectTrigger className="w-40" aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUG_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive/80"
              aria-label="Delete report"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <section className="space-y-2 rounded-md border p-4 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium">{report.title}</h3>
          <span className={cn('px-2 inline-flex text-xs leading-5 font-semibold rounded-full', status.badge)}>
            {status.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {BUG_CATEGORY_LABELS[report.category]} · {report.reporter.username || 'Unknown'} ·{' '}
          {formatBugDate(report.createdAt)}
        </p>
        <div className="text-sm min-w-0"><MarkdownRenderer text={report.body} /></div>
        <Diagnostics diagnostics={report.diagnostics} />
      </section>

      <div className="space-y-2 min-w-0">
        {comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              // A reply from the team is tinted so it reads as an answer rather than another report.
              className={cn(
                'rounded-md border p-3 min-w-0',
                comment.author.isAdmin && 'border-primary/40 bg-primary/5'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {comment.author.isAdmin ? 'Formamorph Team' : comment.author.username || 'Unknown'}
                  {' · '}{formatBugDate(comment.createdAt)}
                  {/* Said plainly, so the other reader can tell a reply changed after they read it. */}
                  {comment.editedAt && <span className="italic"> · edited</span>}
                </p>

                {comment.author.id === myId && editingId !== comment.id && (
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Edit comment"
                      onClick={() => { setEditingId(comment.id); setEditDraft(comment.body); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive/80"
                      aria-label="Delete comment"
                      onClick={() => setPendingCommentDelete(comment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
          ))
        )}
      </div>

      {!canWrite ? (
        // Readable by anyone, writable by the two sides of it — the server refuses the post either way,
        // so an empty box here would just be an error waiting to happen.
        <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
          You&apos;re reading somebody else&apos;s report. Replies are between the reporter and the team.
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
        title="Delete this report?"
        description="The report and its whole thread go for good. The reporter is not told."
        onConfirm={() => { remove(); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
