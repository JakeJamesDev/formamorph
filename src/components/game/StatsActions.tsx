import { Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** The Stats panel's Edit Stats and Re-generate Stats pair, bound to the viewed turn. */
export function StatsActions({ past, busy, editing, onEditingChange, onRegenerate, className }: {
  /** The viewed turn is a past one. */
  past: boolean;
  /** A reply or scene render runs, or no turn exists yet. */
  busy: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  /** Absent when stat updates are off or the world has no stats, which hides Re-generate Stats. */
  onRegenerate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <Tip tip="Edit Stats">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEditingChange(!editing)}
          disabled={past}
          aria-label="Edit Stats"
          aria-pressed={editing}
          className="h-8 w-8"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </Tip>
      {onRegenerate && (
        <Tip tip="Re-generate Stats">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRegenerate}
            disabled={past || busy}
            aria-label="Re-generate Stats"
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </Tip>
      )}
    </div>
  );
}
