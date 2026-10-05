import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TOOLBAR_BTN } from '@/components/prompt/toolbarStyles';
import { cn } from '@/lib/utils';

/** A code toolbar's insert-menu trigger: its icon and its label. Forwards its ref for `PopoverTrigger`. */
export const InsertMenuButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & {
  label: string;
  Icon: LucideIcon;
}>(({ label, Icon, className, ...props }, ref) => (
  // No tip: the button wears the label beside its icon, so a tip would repeat it word for word.
  <button
    ref={ref}
    type="button"
    aria-label={label}
    {...props}
    // Keeps the editor's caret where the insert lands.
    onMouseDown={(event) => event.preventDefault()}
    className={cn(TOOLBAR_BTN, 'flex items-center gap-1 data-[state=open]:bg-accent data-[state=open]:text-foreground', className)}
  >
    <Icon className="h-4 w-4" />
    <span className="text-meta">{label}</span>
  </button>
));
InsertMenuButton.displayName = 'InsertMenuButton';
