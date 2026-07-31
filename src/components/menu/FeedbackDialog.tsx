import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { MessageSquarePlus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromptField from "@/components/prompt/PromptField";
import { plainVocabulary } from "@/lib/chipVocabulary";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import { collectDiagnostics, DIAGNOSTIC_LABELS } from "@/lib/bugDiagnostics";
import { CATEGORY_OPTIONS, DEFAULT_CATEGORY, FEEDBACK_TYPE_LABELS } from "@/lib/feedbackPresentation";
import FeedbackService from "@/services/FeedbackService";
import { FEEDBACK_TYPES, type BugDiagnostics, type FeedbackCategory, type FeedbackType } from "@/types";

/** Mirrors the server's caps so the field limits agree with what it will accept. */
const TITLE_MAX = 120;
const BODY_MAX = 4000;

/** What each branch asks for, in its own words. */
const COPY: Record<FeedbackType, {
  description: string;
  titlePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  submit: string;
  sent: string;
}> = {
  bug: {
    description: 'Filed against your account, so we can ask follow-up questions. You’ll find replies under Bugs in your profile.',
    titlePlaceholder: 'What went wrong, in a line',
    bodyLabel: 'What happened',
    bodyPlaceholder: 'What you did, what you expected, what happened instead',
    submit: 'Send Report',
    sent: 'Report filed — you can follow it under Bugs in your profile',
  },
  suggestion: {
    description: 'Everyone can read and vote on suggestions, so it’s worth checking whether yours is already there. Replies land under Suggestions in your profile.',
    titlePlaceholder: 'What you’d like, in a line',
    bodyLabel: 'What you have in mind',
    bodyPlaceholder: 'What it would do, and what it would let you do that you can’t today',
    submit: 'Send Suggestion',
    sent: 'Suggestion filed — you can follow it under Suggestions in your profile',
  },
};

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which branch to open on. Defaults to a bug report. */
  initialType?: FeedbackType;
  /** Called after something is filed, so a list showing the caller's own can pick it up. */
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

/**
 * File a bug report or a suggestion. Opened from the menu footer, from in-game, and from either feedback
 * tab in the profile dialog.
 *
 * One dialog with a tab rather than two: the forms differ by a dropdown's contents and whether anything
 * about the machine goes with it, which is not two dialogs' worth of difference.
 */
export function FeedbackDialog({ open, onOpenChange, initialType = 'bug', onFiled }: FeedbackDialogProps) {
  const [type, setType] = useState<FeedbackType>(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>(DEFAULT_CATEGORY[initialType]);
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  // No chip family: this is prose, and an authored world's placeholders mean nothing here.
  const plainVocab = useMemo(() => plainVocabulary(), []);
  // Read once per opening: the build and platform cannot change while the dialog is up.
  const [diagnostics, setDiagnostics] = useState<BugDiagnostics>({});

  useResetOnOpen(open, () => {
    setType(initialType);
    setTitle('');
    setCategory(DEFAULT_CATEGORY[initialType]);
    setBody('');
    setIsSending(false);
    setDiagnostics(collectDiagnostics());
  });

  /** Switching branch keeps what has been written but resets the category — the two lists share no
   *  values a draft could carry across, and a stale one would be refused by the server. */
  const switchType = (next: FeedbackType) => {
    setType(next);
    setCategory(DEFAULT_CATEGORY[next]);
  };

  const copy = COPY[type];

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
      await FeedbackService.file({ type, title: title.trim(), category, body: body.trim() });
      toast.success(copy.sent);
      onFiled?.();
      onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to send this');
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
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" /> Send Feedback
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0">
          <Tabs value={type} onValueChange={(value) => switchType(value as FeedbackType)}>
            <TabsList className="grid w-full grid-cols-2">
              {FEEDBACK_TYPES.map((value) => (
                <TabsTrigger key={value} value={value}>{FEEDBACK_TYPE_LABELS[value].tab}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <label htmlFor="feedbackTitle" className="text-sm font-medium">Title</label>
            <Input
              id="feedbackTitle"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={copy.titlePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={(value) => setCategory(value as FeedbackCategory)}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS[type].map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{copy.bodyLabel}</span>
              <span className="text-xs text-muted-foreground">{body.length} / {BODY_MAX}</span>
            </div>
            <PromptField
              value={body}
              onChange={(next) => setBody(next.slice(0, BODY_MAX))}
              vocabulary={plainVocab}
              markdown
              ariaLabel={copy.bodyLabel}
              placeholder={copy.bodyPlaceholder}
              className="h-[260px]"
            />
          </div>

          {/* Bugs only. A suggestion is about the game, not about the machine it was written on, so there
              is nothing to disclose because nothing is collected. */}
          {type === 'bug' && <DiagnosticsPanel diagnostics={diagnostics} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
          <Button onClick={submit} disabled={isSending}>{isSending ? 'Sending…' : copy.submit}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
