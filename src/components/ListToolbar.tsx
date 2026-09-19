import { forwardRef, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The row above an editor list: the + button first, then whatever the list offers beside it. */
export function ListToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-shrink-0 items-center gap-2', className)}>{children}</div>;
}

/** The + icon button that adds to an editor list. Forwards its ref so a popover can use it as a trigger. */
export const ListAddButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'children' | 'size'> & { label: string }>(
  ({ label, className, ...props }, ref) => (
    <Button ref={ref} size="icon" aria-label={label} className={cn('h-9 w-9 shrink-0', className)} {...props}>
      <Plus className="h-4 w-4" />
    </Button>
  ),
);
ListAddButton.displayName = 'ListAddButton';
