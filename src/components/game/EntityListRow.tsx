import { Footprints, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { DESTRUCTIVE_ROW_ACTION_HOVER } from '@/components/EditorRow';
import { YouMark } from '@/components/game/YouMark';
import { cn } from '@/lib/utils';

/** One row of the Entities tab: the name the player knows the entity by, a mark when it follows the player,
 *  and a remove control when `onRemove` is given. */
export function EntityListRow({ label, you, following, selected = false, disabled, onClick, onRemove }: {
  label: string;
  /** The played persona's row: the You pill follows the name. */
  you?: boolean;
  following?: boolean;
  /** The entity the entity view shows. */
  selected?: boolean;
  /** An authored entity that failed to resolve: shown, but it opens nothing. */
  disabled?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  // Selected rows sit on the primary fill, so their chrome inverts with them.
  const chrome = selected ? 'text-primary-foreground' : 'text-muted-foreground';
  return (
    <div
      aria-current={selected || undefined}
      className={cn(
        'mb-1 flex justify-between items-center gap-2 rounded-md p-2 transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        selected ? 'bg-primary text-primary-foreground' : !disabled && 'hover:bg-secondary',
      )}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center">
        <span className="min-w-0 truncate">{label}</span>
        {you && <YouMark onFill={selected} />}
      </span>
      {(following || onRemove) && (
        <span className="flex items-center gap-1 shrink-0">
          {following && (
            <Tip tip="Following you">
              <span role="img" className={cn('flex h-6 w-6 items-center justify-center', chrome)}>
                <Footprints className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Tip>
          )}
          {onRemove && (
            <Tip tip={`Remove ${label}`}>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-6 w-6', chrome, DESTRUCTIVE_ROW_ACTION_HOVER)}
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Tip>
          )}
        </span>
      )}
    </div>
  );
}
