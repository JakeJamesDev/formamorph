import { useState } from "react";
import { toast } from "react-toastify";
import { Flag } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useResetOnOpen } from "@/lib/useResetOnOpen";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_DETAILS_MAX,
  reportDraftError,
  type ReportCategory,
  type ReportTargetKind,
} from "@/lib/contentReports";
import ReportService, { AlreadyReportedError } from "@/services/ReportService";

/**
 * What a report is aimed at.
 *
 * `noun` is what the surface that opened this calls the thing — a listing is a World, an Entity or a
 * Dictionary depending on where you are, and the dialog saying "listing" over a button that said
 * "World" reads as two different things. Omit it for the kind's own word.
 *
 * For comments, `name` is the listing the comment sits on and `author` is who wrote the comment —
 * comments have no name of their own, so the line names both instead.
 */
export interface ReportTarget {
  kind: ReportTargetKind;
  id: string;
  name?: string | null;
  noun?: string;
  author?: string | null;
}

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being reported. Null closes the dialog without a target to send. */
  target: ReportTarget | null;
}

/** What each kind of target is called when the surface that opened this offers no word of its own. */
const TARGET_NOUNS: Record<ReportTargetKind, string> = {
  listing: 'listing',
  comment: 'comment',
  profile: 'profile',
};

/**
 * Report something to staff.
 *
 * One-shot by design: a category, optionally a line about why, and then it is with staff. There is no
 * thread and no status page — the answer arrives once as a message in the reader's inbox, which is why
 * the confirmation here says where to expect it.
 */
export function ReportDialog({ open, onOpenChange, target }: ReportDialogProps) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [isSending, setIsSending] = useState(false);
  // Set when this reporter's earlier report on the same target is still open. A state rather than a
  // failure, so it is said in the dialog instead of thrown at a toast.
  const [pending, setPending] = useState<string | null>(null);

  useResetOnOpen(open, () => {
    setCategory(null);
    setDetails('');
    setPending(null);
  });

  const noun = target ? (target.noun ?? TARGET_NOUNS[target.kind]) : 'content';
  // Title Case for the heading, because it is a label rather than a sentence.
  const titleNoun = noun.replace(/\b\w/g, (letter) => letter.toUpperCase());

  const submit = async () => {
    if (!target) return;

    const error = reportDraftError({ category, details });
    if (error) {
      toast.error(error);
      return;
    }

    setIsSending(true);
    try {
      await ReportService.file({
        targetKind: target.kind,
        targetId: target.id,
        category: category as ReportCategory,
        details: details.trim() || undefined,
      });

      toast.success('Report sent — you will hear back in your messages.');
      onOpenChange(false);
    } catch (e) {
      if (e instanceof AlreadyReportedError) {
        setPending(e.message);
        return;
      }

      toast.error((e as Error).message || 'Failed to send this report');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" /> Report {target?.kind === 'profile' ? titleNoun : `This ${titleNoun}`}
          </DialogTitle>
          <DialogDescription>
            {/* Said up front, because it is the question that decides whether somebody reports at all. */}
            Staff see this; the author never learns who reported them. You will get a message when it has
            been reviewed.
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <p className="text-label text-muted-foreground py-2">{pending}</p>
        ) : (
          <div className="space-y-4 py-2">
            {target?.name && (
              <p className="text-helper text-muted-foreground truncate">
                {target.kind === 'comment' ? (
                  <>
                    Reporting{' '}
                    {target.author
                      ? <><span className="font-medium text-foreground">{target.author}</span>&rsquo;s</>
                      : 'a'}{' '}
                    comment on <span className="font-medium text-foreground">{target.name}</span>
                  </>
                ) : (
                  <>Reporting the {noun} <span className="font-medium text-foreground">{target.name}</span></>
                )}
              </p>
            )}

            {/* All six at once rather than behind a dropdown: picking the right one *is* the triage
                signal, and the reasons only separate when they can be read against each other. */}
            <fieldset className="space-y-2">
              <legend className="text-label font-medium mb-2">What is wrong with it</legend>
              <RadioGroup
                value={category ?? ''}
                onValueChange={(value) => setCategory(value as ReportCategory)}
              >
                {REPORT_CATEGORIES.map((value) => (
                  <div key={value} className="flex items-center gap-2">
                    <RadioGroupItem value={value} id={`report-${value}`} />
                    <label htmlFor={`report-${value}`} className="text-label cursor-pointer">
                      {REPORT_CATEGORY_LABELS[value]}
                    </label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <label htmlFor="reportDetails" className="text-label font-medium">
                  Anything else <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <span className="text-meta text-muted-foreground">
                  {details.length} / {REPORT_DETAILS_MAX}
                </span>
              </div>
              <Textarea
                id="reportDetails"
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, REPORT_DETAILS_MAX))}
                placeholder="What staff should know that the reason above does not say"
                className="h-28"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            {pending ? 'Close' : 'Cancel'}
          </Button>
          {!pending && (
            <Button onClick={submit} disabled={isSending || !category}>
              {isSending ? 'Sending…' : 'Send Report'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
