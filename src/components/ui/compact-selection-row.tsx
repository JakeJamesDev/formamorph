import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A simple choice with no reserved columns; long names set their own height. */
export const CompactSelectionRow = forwardRef<HTMLButtonElement,
  ComponentPropsWithoutRef<'button'> & { selected?: boolean }
>(({ selected = false, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-pressed={selected}
    className={cn(
      'flex min-h-8 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-label outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary',
      className,
    )}
    {...props}
  >
    <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{children}</span>
    {selected && <Check aria-hidden className="h-4 w-4 shrink-0" />}
  </button>
));
CompactSelectionRow.displayName = 'CompactSelectionRow';
