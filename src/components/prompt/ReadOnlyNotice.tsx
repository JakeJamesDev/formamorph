import { Lock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        'flex flex-shrink-0 items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground',
        className,
      )}
      title={reason}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" />
      {/* One line, never wrapped: at phone width the full sentence took two rows off the editor. */}
      <span className="min-w-0 flex-1 truncate">{reason}</span>
      {onRequestEdit && (
        <Button variant="outline" size="sm" className="h-7 shrink-0 px-2" onClick={onRequestEdit}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate &amp; Edit
        </Button>
      )}
    </div>
  );
}
