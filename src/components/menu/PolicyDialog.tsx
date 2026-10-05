import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SurfaceIdName } from "@/components/ui/surface";

interface PolicyDialogProps {
  open: boolean;
  title: string;
  /** Markdown, authored by an admin. */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** A third answer, set apart from the other two. The Privacy Policy prompt's way out of the account
   *  entirely; absent everywhere else, which leaves the usual two buttons. */
  extraLabel?: string;
  onExtra?: () => void;
  /** Disables every button while the acceptance is being recorded. */
  busy?: boolean;
  /** The surface id this prompt reports, for a prompt that has one. */
  surface?: SurfaceIdName;
}

/**
 * An authored popup shown during publishing: the blocking upload gate, or the advisory tag notice.
 *
 * Deliberately not dismissible by Esc or by clicking away — both buttons are meaningful answers, and a
 * stray click should not read as either one.
 */
export function PolicyDialog({
  open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel, extraLabel, onExtra, busy = false, surface,
}: PolicyDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent aria-describedby={undefined}
        surface={surface}
        className="sm:max-w-[560px] max-h-[85dvh] flex flex-col"
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0" focusable>
          <div className="py-2 text-label">
            <MarkdownRenderer text={body} />
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          {/* Pushed away from the other two: it is the one answer that cannot be taken back by
              clicking again. */}
          {extraLabel && onExtra && (
            <Button variant="ghost" className="sm:mr-auto text-destructive" onClick={onExtra} disabled={busy}>
              {extraLabel}
            </Button>
          )}
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
