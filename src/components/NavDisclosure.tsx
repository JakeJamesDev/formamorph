import { forwardRef, type ReactNode } from 'react';
import { ChevronDown, ListTree } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavDisclosureProps {
  /** False draws the body alone at full height, as a sidebar. True folds it behind the bar. */
  collapsed?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  /** The current page's name, at the bar's right end. */
  current: ReactNode;
  bodyId: string;
  className?: string;
  children: ReactNode;
}

/** A full-width bar that names the current page and folds a navigation list below it. The ref is the bar's
 *  button, so a host can return focus to it after a pick. */
export const NavDisclosure = forwardRef<HTMLButtonElement, NavDisclosureProps>(function NavDisclosure(
  { collapsed = true, open, onOpenChange, label, current, bodyId, className, children },
  ref,
) {
  return (
    <div
      className={cn(
        collapsed
          ? cn('border-b bg-secondary/60', open ? 'border-muted-foreground/30' : 'border-border')
          : 'h-full min-h-0',
        className,
      )}
    >
      {collapsed && (
        <button
          ref={ref}
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left text-label"
          onClick={() => onOpenChange(!open)}
        >
          <ListTree className="h-4 w-4 shrink-0" />
          <span className="font-medium">{label}</span>
          <span className="ml-auto min-w-0 truncate text-helper text-muted-foreground">{current}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      )}
      <div
        id={bodyId}
        aria-hidden={collapsed ? !open : undefined}
        {...(collapsed && !open ? { inert: '' } : {})}
        className={cn(
          collapsed && 'grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none',
          !collapsed && 'h-full min-h-0',
        )}
        style={collapsed ? { gridTemplateRows: open ? '1fr' : '0fr' } : undefined}
      >
        <div className={cn('min-h-0', collapsed ? 'overflow-hidden' : 'h-full')}>{children}</div>
      </div>
    </div>
  );
});
