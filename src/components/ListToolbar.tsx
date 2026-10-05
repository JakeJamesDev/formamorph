import { forwardRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MENU_ROW } from '@/components/menuRow';
import { ListAddContext, useListAdd, type ListAddApi, type ListSearch } from '@/components/listToolbarHooks';
import type { TargetAttribute } from '@/lib/surface/surfaceTargets';
import { cn } from '@/lib/utils';

/** The row above an editor list: the + button first, then whatever the list offers beside it. */
export function ListToolbar({ className, children, target }: { className?: string; children: ReactNode; target?: TargetAttribute }) {
  return <div className={cn('flex flex-shrink-0 items-center gap-2', className)} {...target}>{children}</div>;
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

/** A row of a + menu. Its action receives the trimmed search text; the box clears and the menu closes after. */
export function ListMenuRow({ icon, label, onAdd }: { icon?: ReactNode; label: ReactNode; onAdd: (typed: string) => void }) {
  const { add } = useListAdd();
  return (
    <button type="button" className={MENU_ROW} onClick={() => add(onAdd)}>
      {icon} {label}
    </button>
  );
}

/** One add action, or a menu of them. Either way the action receives the trimmed search text. */
export type ListAddSlot =
  | { label: string; onAdd: (typed: string) => void }
  | { label: string; menu: ReactNode; menuClassName?: string };

/**
 * The search box and + control above an editor list. The search text filters the list and names the next
 * item added; the box clears after an add. `children` sit between the + and the box, `after` past the box.
 * Rows compose the menu with `ListMenuRow`, or reach the add through `useListAdd`. The + carries the
 * authoring tour's `list-add` anchor and the box opts out of the find bar's field walk.
 */
export function ListSearchToolbar({ search, add, placeholder, className, children, after, target }: {
  search: ListSearch;
  add: ListAddSlot;
  placeholder: string;
  className?: string;
  children?: ReactNode;
  after?: ReactNode;
  /** Marks the row as a Take Me There target. */
  target?: TargetAttribute;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const api: ListAddApi = { add: (action) => { action(search.typed); search.clear(); setMenuOpen(false); } };
  return (
    <ListToolbar className={className} target={target}>
      {'menu' in add ? (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <ListAddButton label={add.label} data-tour-anchor="list-add" />
          </PopoverTrigger>
          {/* Inline, so a host modal's scroll lock lets the wheel reach a drill-in's list. */}
          <PopoverContent portal={false} side="bottom" align="start" className={cn('w-44 overflow-hidden p-1', add.menuClassName)}>
            <ListAddContext.Provider value={api}>{add.menu}</ListAddContext.Provider>
          </PopoverContent>
        </Popover>
      ) : (
        <ListAddButton label={add.label} data-tour-anchor="list-add" onClick={() => api.add(add.onAdd)} />
      )}
      {children}
      <Input
        data-editor-find-skip
        placeholder={placeholder}
        value={search.term}
        onChange={(e) => search.setTerm(e.target.value)}
      />
      {after}
    </ListToolbar>
  );
}
