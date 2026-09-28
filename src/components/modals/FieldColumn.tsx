import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FIELD_COLUMN_CLASS } from './libraryEditorLayout';

/** The library editors' form column, capped at a readable width. `fill` takes the host's height for a panel that scrolls itself. */
export function FieldColumn({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <div data-field-column className={cn(FIELD_COLUMN_CLASS, fill && 'flex min-h-0 flex-1 flex-col')}>
      {children}
    </div>
  );
}
