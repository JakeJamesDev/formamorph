import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/game/MarkdownRenderer";

interface PolicyDialogProps {
  open: boolean;
  title: string;
  /** Markdown, authored by an admin. */
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Disables both buttons while the acceptance is being recorded. */
  busy?: boolean;
}

/**
 * An authored popup shown during publishing: the blocking upload gate, or the advisory tag notice.
 *
 * Deliberately not dismissible by Esc or by clicking away — both buttons are meaningful answers, and a
 * stray click should not read as either one.
 */
export function PolicyDialog({
  open, title, body, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false,
}: PolicyDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[560px] max-h-[85dvh] overflow-y-auto"
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* `min-w-0`: DialogContent is a grid, and a grid item's `min-width: auto` lets long authored
            text widen the dialog past its max width. */}
        <div className="py-2 text-sm min-w-0">
          <MarkdownRenderer text={body} />
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
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
