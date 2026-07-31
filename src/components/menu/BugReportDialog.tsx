import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Bug } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { collectDiagnostics, DIAGNOSTIC_LABELS } from "@/lib/bugDiagnostics";
import { BUG_CATEGORY_OPTIONS } from "@/lib/bugPresentation";
import BugService from "@/services/BugService";
import type { BugCategory, BugDiagnostics } from "@/types";

/** Mirrors the server's caps so the field limits agree with what it will accept. */
const TITLE_MAX = 120;
const BODY_MAX = 4000;

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a report is filed, so a list showing the reporter's own can pick it up. */
  onFiled?: () => void;
}

/** The reporter's diagnostics, shown before sending — nothing about them leaves silently. */
function DiagnosticsPanel({ diagnostics }: { diagnostics: BugDiagnostics }) {
  const rows = (Object.keys(DIAGNOSTIC_LABELS) as (keyof BugDiagnostics)[])
    .map((key) => [DIAGNOSTIC_LABELS[key], diagnostics[key]] as const)
    .filter(([, value]) => Boolean(value));

  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground min-w-0">
      <p className="font-medium text-foreground">Sent with your report</p>
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd className="truncate text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1">Nothing about your worlds or saves is included.</p>
    </div>
  );
}

/** File a bug report. Opened from the menu footer, from in-game, and from the profile dialog's Bugs tab. */
export function BugReportDialog({ open, onOpenChange, onFiled }: BugReportDialogProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BugCategory>('crash');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // No chip family: a report is prose, and an authored world's placeholders mean nothing here.
  const plainVocab = useMemo(() => plainVocabulary(), []);
  // Read once per opening: the build and platform cannot change while the dialog is up.
  const [diagnostics, setDiagnostics] = useState<BugDiagnostics>({});

  useResetOnOpen(open, () => {
    setTitle('');
    setCategory('crash');
    setBody('');
    setIsSending(false);
    setDiagnostics(collectDiagnostics());
  });

  const submit = async () => {
    if (!title.trim()) {
      toast.error('A title is required');
      return;
    }
    if (!body.trim()) {
      toast.error('A description is required');
      return;
    }

    setIsSending(true);
    try {
      await BugService.file({ title: title.trim(), category, body: body.trim() });
      toast.success('Report filed — you can follow it under Bugs in your profile');
      onFiled?.();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to file the report');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `min-w-0` on the children: DialogContent is a grid, and a grid item's `min-width: auto` lets
          wide content widen the dialog past its max width instead of being contained. */}
      <DialogContent className="sm:max-w-[800px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bug className="h-4 w-4" /> Report a Bug</DialogTitle>
          <DialogDescription>
            Filed against your account, so we can ask follow-up questions. You&apos;ll find replies under
            Bugs in your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          <div className="space-y-2">
            <label htmlFor="bugTitle" className="text-sm font-medium">Title</label>
            <Input
              id="bugTitle"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What went wrong, in a line"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={(value) => setCategory(value as BugCategory)}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUG_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">What happened</span>
              <span className="text-xs text-muted-foreground">{body.length} / {BODY_MAX}</span>
            </div>
            <PromptField
              value={body}
              onChange={(next) => setBody(next.slice(0, BODY_MAX))}
              vocabulary={plainVocab}
              markdown
              ariaLabel="What happened"
              placeholder="What you did, what you expected, what happened instead"
              className="h-[260px]"
            />
          </div>

          <DiagnosticsPanel diagnostics={diagnostics} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
          <Button onClick={submit} disabled={isSending}>{isSending ? 'Sending…' : 'Send Report'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
