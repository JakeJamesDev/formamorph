import type { ReactNode } from 'react';
import { FIELD_COLUMN_CLASS } from './libraryEditorLayout';

/** The library editors' form column, capped at a readable width. */
export function FieldColumn({ children }: { children: ReactNode }) {
  return (
    <div data-field-column className={FIELD_COLUMN_CLASS}>
      {children}
    </div>
  );
}
