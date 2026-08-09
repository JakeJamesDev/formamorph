import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { CATEGORY_OPTIONS, FEEDBACK_TYPE_LABELS } from "@/lib/feedbackPresentation";
import { categoryForType, changedFields, type EditDraft } from "@/lib/feedbackEditing";
import FeedbackService from "@/services/FeedbackService";
import type { FeedbackCategory, FeedbackThread, FeedbackType } from "@/types";

/** Mirrors the server's caps so the fields agree with what it will accept. */
const TITLE_MAX = 120;
const BODY_MAX = 4000;

interface FeedbackEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: FeedbackThread;
  /** Whether to offer the title and description. */
  mayEditProse: boolean;
  /** Whether to offer the category and the branch it sits on. */
  mayRefile: boolean;
  /** Handed the thread as it now reads. */
  onSaved: (thread: FeedbackThread) => void;
}

/**
 * Rewriting a report.
 *
 * The dialog only ever shows what this reader may change, so there is nothing to press that would be
 * refused: a reporter sees their own words, the team sees the filing, and on a bug they see both.
 */
export function FeedbackEditDialog({
  open, onOpenChange, thread, mayEditProse, mayRefile, onSaved,
}: FeedbackEditDialogProps) {
  const [draft, setDraft] = useState<EditDraft>({
    title: thread.title, body: thread.body, category: thread.category, type: thread.type,
  });
  const [saving, setSaving] = useState(false);
  // No chip family: a report is prose, and an authored world's placeholders mean nothing in one.
  const [plainVocab] = useState(() => plainVocabulary());

  // Reset on every open, and whenever the thread underneath changes — a stale draft would quietly
  // overwrite somebody else's edit with what was on screen before it.
  useEffect(() => {
    if (open) {
      setDraft({ title: thread.title, body: thread.body, category: thread.category, type: thread.type });
    }
  }, [open, thread]);

  const categories = CATEGORY_OPTIONS[draft.type as FeedbackType];
  // A type move takes the category with it: the two lists share only three values, so whatever was
  // selected is usually not one the new branch has.
  const pickType = (type: string) => {
    setDraft((prev) => ({ ...prev, type, category: categoryForType(type, prev.category) }));
  };

  const changes = changedFields(draft, thread, { prose: mayEditProse, refile: mayRefile });
  const nothingToSave = Object.keys(changes).length === 0;
  const incomplete = mayEditProse && (!draft.title.trim() || !draft.body.trim());

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await FeedbackService.update(thread.id, changes as {
        title?: string; body?: string; category?: FeedbackCategory; type?: FeedbackType;
      }));
      onOpenChange(false);
      toast.success('Saved');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save the changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit This Report</DialogTitle>
          <DialogDescription>
            {mayEditProse && mayRefile
              ? 'Rewrite it, or file it somewhere else.'
              : mayEditProse
                ? 'Fix what you wrote. Everyone reading the thread sees that it was edited.'
                : 'Re-file it. The wording stays as its author wrote it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          {mayEditProse && (
            <>
              <div className="space-y-2">
                <label htmlFor="feedback-edit-title" className="text-label font-medium">Title</label>
                <Input
                  id="feedback-edit-title"
                  value={draft.title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-label font-medium">Description</span>
                  <span className="text-meta text-muted-foreground">{draft.body.length} / {BODY_MAX}</span>
                </div>
                <PromptField
                  value={draft.body}
                  onChange={(body) => setDraft((prev) => ({ ...prev, body: body.slice(0, BODY_MAX) }))}
                  vocabulary={plainVocab}
                  markdown
                  ariaLabel="Description"
                  className="h-[240px]"
                />
              </div>
            </>
          )}

          {mayRefile && (
            <div className="flex flex-wrap gap-4">
              <div className="space-y-2 min-w-[160px] flex-1">
                <span className="text-label font-medium">Kind</span>
                <Select value={draft.type} onValueChange={pickType}>
                  <SelectTrigger aria-label="Kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['bug', 'suggestion'] as const).map((value) => (
                      <SelectItem key={value} value={value}>{FEEDBACK_TYPE_LABELS[value].one}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 min-w-[160px] flex-1">
                <span className="text-label font-medium">Category</span>
                <Select
                  value={draft.category}
                  onValueChange={(category) => setDraft((prev) => ({ ...prev, category }))}
                >
                  <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Said before it happens, not discovered after: a move costs the reporter's machine details
              and puts the thread back at the start of triage. */}
          {draft.type !== thread.type && (
            <p className="rounded-md border border-warning/40 bg-warning/5 p-3 text-meta text-muted-foreground">
              Moving this to a {FEEDBACK_TYPE_LABELS[draft.type as FeedbackType].one.toLowerCase()} sets its status
              back to Open{thread.type === 'bug' ? ', and deletes the version and platform it was filed with' : ''}.
              Its replies and votes stay.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || nothingToSave || incomplete}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
