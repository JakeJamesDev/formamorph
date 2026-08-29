import { Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Why a preset's controls won't take input, and the way out. A locked surface looks broken rather than
 * protected — the caret does nothing, a dropdown won't open — so it says what is read-only and offers to
 * duplicate it. Shared by the prompt editor and the per-prompt Options panel so both read identically.
 */
export function ReadOnlyNotice({ reason, onRequestEdit, className }: {
  /** What is read-only, named for the reader (e.g. a built-in preset's name). */
  reason: string;
  /** Duplicate the preset and edit the copy. Omitted where there is nothing to offer. */
  onRequestEdit?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Stays at meta on mobile: the line never wraps, and at helper size even the shortest reason
        // ("Default is read-only") loses its last characters to the ellipsis.
        'flex flex-shrink-0 items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1 text-meta sm:text-helper text-muted-foreground',
        className,
      )}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" />
      {/* One line, never wrapped: at mobile width the full sentence took two rows off the editor. The tip
          carries the tail the ellipsis eats, and rides the text rather than the row — the row holds a
          button, and a tab stop wrapped around one reads as a control that does nothing. */}
      <Tip tip={reason} labelsChild={false}>
        <span className="min-w-0 flex-1 truncate">{reason}</span>
      </Tip>
      {onRequestEdit && (
        <Button variant="outline" size="sm" className="h-7 shrink-0 px-2" onClick={onRequestEdit}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate &amp; Edit
        </Button>
      )}
    </div>
  );
}
