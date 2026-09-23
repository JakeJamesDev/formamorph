import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';

/** One row of the Entities tab: the name the player knows the entity by, and a remove control when
 *  `onRemove` is given. */
export function EntityListRow({ label, disabled, onClick, onRemove }: {
  label: string;
  /** An authored entity that failed to resolve: shown, but it opens nothing. */
  disabled?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`mb-1 flex justify-between items-center gap-2 p-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'
      }`}
      onClick={onClick}
    >
      <span className="min-w-0 truncate">{label}</span>
      {onRemove && (
        <span className="flex items-center gap-1 shrink-0">
          <Tip tip={`Remove ${label}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tip>
        </span>
      )}
    </div>
  );
}
