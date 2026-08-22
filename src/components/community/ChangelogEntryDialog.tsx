import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import {
  CHANGELOG_BODY_MAX,
  CHANGELOG_TITLE_MAX,
  changelogDraftError,
  todayForDateInput,
  type ChangelogDraft,
} from "@/lib/listingChangelog";

interface ChangelogEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entry being rewritten. Absent writes a new one, dated today. */
  entry?: ChangelogDraft | null;
  /** Hands back the finished draft. Throwing leaves the popup open with the message. */
  onSubmit: (draft: ChangelogDraft) => void | Promise<void>;
  /** The button's word, so the publish flow can say what it is really doing ("Attach"). */
  submitLabel?: string;
  /** Replaces the default line under the title, for a surface where the entry is not sent immediately. */
  description?: string;
}

/**
 * The one popup that writes a Changelog Entry.
 *
 * Every surface uses this one — adding, backfilling, rewriting, and the optional note attached to a
 * publish — so writing an entry is the same act wherever it starts. It edits exactly one entry and knows
 * nothing about where the entry goes; the caller decides whether "submit" means a request now or a draft
 * held until a publish succeeds.
 */
export function ChangelogEntryDialog({
  open, onOpenChange, entry = null, onSubmit, submitLabel, description,
}: ChangelogEntryDialogProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(todayForDateInput());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const editing = Boolean(entry);

  // On open rather than on close: clearing in the close handler would revert the still-visible fields
  // for the frames the exit animation keeps them mounted.
  useResetOnOpen(open, () => {
    setTitle(entry?.title ?? '');
    setBody(entry?.body ?? '');
    setDate(entry?.date ?? todayForDateInput());
    setError('');
    setSaving(false);
  });

  const handleSubmit = async () => {
    const draft: ChangelogDraft = { title: title.trim(), body: body.trim(), date };
    const invalid = changelogDraftError(draft);
    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);
    try {
      await onSubmit(draft);
      onOpenChange(false);
    } catch (failure) {
      // Kept in the popup rather than thrown at a toast: what the author wrote is still on screen, and a
      // refusal they can act on belongs beside the field it is about.
      setError((failure as Error).message || 'Failed to save the entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Changelog Entry' : 'Add Changelog Entry'}</DialogTitle>
          <DialogDescription>
            {description ?? 'Tell readers what changed. Entries are shown newest first, under the date you set.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="changelogTitle">Title</Label>
            <Input
              id="changelogTitle"
              value={title}
              maxLength={CHANGELOG_TITLE_MAX}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Update 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="changelogDate">Date</Label>
            <Input
              id="changelogDate"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-fit"
            />
            {/* The reason the field is here at all: a history written after the fact should carry the days
                it happened on, not the day it was typed up. */}
            <p className="text-meta text-muted-foreground">
              Set this back to log an update you made earlier.
            </p>
          </div>

          {/* Lexical renders a div, so the caption names the field through `ariaLabel` rather than `htmlFor`. */}
          <div className="space-y-2 min-w-0">
            <Label>What Changed</Label>
            <PromptField
              value={body}
              onChange={(next) => setBody(next.slice(0, CHANGELOG_BODY_MAX))}
              vocabulary={plainVocabulary()}
              markdown
              ariaLabel="What changed"
              placeholder="Added the drowned quarter, and fixed the ferry never arriving..."
            />
            <p className="text-meta text-muted-foreground text-right">
              {body.length} / {CHANGELOG_BODY_MAX}
            </p>
          </div>

          {error && (
            <p className="text-label text-destructive" role="alert">{error}</p>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : submitLabel ?? (editing ? 'Save Entry' : 'Add Entry')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
