import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MarkdownPanel } from '@/components/MarkdownPanel';

/**
 * A titled dialog whose body is one `MarkdownPanel` — the shape shared by the world Readme and the help
 * pop-outs, sized to match the changelog popup. `footer` is each caller's own trailing control (Readme's
 * "Don't Show This Again", help's "Learn more" link); omit it for a body-only dialog.
 */
export function MarkdownModal({ open, onOpenChange, title, text, footer }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <MarkdownPanel text={text} className="max-h-[60dvh]" />
        {footer}
      </DialogContent>
    </Dialog>
  );
}
