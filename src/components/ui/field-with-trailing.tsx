import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A field frame for an input and its trailing cells, with one focus ring around all of them. */
export function FieldWithTrailing({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('group/field relative min-w-0', className)}>
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-md ring-ring ring-inset group-focus-within/field:ring-2"
      />
    </div>
  );
}
