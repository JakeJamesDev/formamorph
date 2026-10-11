import { useRef, type SyntheticEvent } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import type { LinkSafetyModalProps } from 'streamdown';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { copyWithToast } from '@/lib/clipboard';

/** Events from the portaled dialog bubble the React tree to the link's ancestors, such as a clickable card. */
const stop = (event: SyntheticEvent) => event.stopPropagation();

/**
 * The confirm before a markdown link opens a website. It replaces Streamdown's own modal, which sits under
 * the body's `pointer-events: none` while a Radix dialog is open.
 */
export function ExternalLinkDialog({ url, isOpen, onClose, onConfirm }: LinkSafetyModalProps) {
  const host = useRef<HTMLSpanElement>(null);
  return (
    <span ref={host} className="contents" onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            // Streamdown renders the dialog right after its link button.
            const link = host.current?.previousElementSibling;
            if (!(link instanceof HTMLElement)) return;
            event.preventDefault();
            link.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Open External Link?
            </AlertDialogTitle>
            <AlertDialogDescription>This link opens a website outside Formamorph.</AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollArea className="max-h-32 rounded-md bg-muted">
            <p className="break-all p-3 font-mono text-helper">{url}</p>
          </ScrollArea>
          <AlertDialogFooter>
            <Button variant="outline" className="sm:mr-auto" onClick={() => copyWithToast(url)}>
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Copy Link
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Open Link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
