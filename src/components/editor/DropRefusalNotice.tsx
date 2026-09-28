import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The line above a tree after a refused drop: why the dragged item stays put, and a Dismiss. */
export function DropRefusalNotice({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  return (
    <div role="status" className="mb-2 flex items-start gap-2 rounded-lg border p-3 text-helper">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span className="flex-1">{children}</span>
      <Button type="button" variant="ghost" size="sm" className="-my-1 h-7" onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}
