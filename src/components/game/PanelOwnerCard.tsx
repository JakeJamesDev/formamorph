import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { EntityIcon } from '@/lib/elementIcons';
import { cn } from '@/lib/utils';
import { YouMark } from './YouMark';

/** The side panel's per-owner card on the Stats and Traits tabs: a collapsible header over the owner's rows.
 *  Without `open` the card holds its own fold, starting open. A null `name` draws the card with no header. */
export function PanelOwnerCard({
  name, entity = false, you = false, badge, open, onToggle, disabled, toggleLabel, children, className, ...rest
}: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  name: ReactNode | null;
  entity?: boolean;
  you?: boolean;
  badge?: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  /** The header button's accessible name, when its text alone says too little. */
  toggleLabel?: string;
  children: ReactNode;
}) {
  const [ownOpen, setOwnOpen] = useState(true);
  const isOpen = name === null || (open ?? ownOpen);
  return (
    <div className={cn('rounded-lg bg-muted/40 p-1.5', className)} {...rest}>
      {name !== null && (
        <h3>
          <button
            type="button"
            onClick={onToggle ?? (() => setOwnOpen((o) => !o))}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-label={toggleLabel}
            className="flex w-full items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-left text-primary"
          >
            {entity && <EntityIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />}
            <span className="min-w-0 flex-1 truncate font-semibold">{name}{you && <YouMark />}</span>
            {badge}
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', !isOpen && '-rotate-90')} aria-hidden />
          </button>
        </h3>
      )}
      {isOpen && <div className="pt-1">{children}</div>}
    </div>
  );
}

/** A group's heading inside an owner card: the path of group names, flat rather than nested. */
export function PanelSubheader({ children }: { children: ReactNode }) {
  return (
    <p className="mb-0.5 mt-1.5 flex items-center gap-1 pl-1 text-meta font-medium text-muted-foreground">{children}</p>
  );
}
