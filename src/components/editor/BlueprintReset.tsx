import type { ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/typography';

/**
 * The Reset on an overridden field of a link or copy, at the end of the field's label row. `stale` adds the
 * "Blueprint changed" marker beside it. `field` names the field for assistive tech, so each Reset on a
 * panel has its own name.
 */
export function FieldReset({ field, stale = false, onReset }: { field: string; stale?: boolean; onReset: () => void }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      {stale && (
        <Meta as="span" className="flex items-center gap-1 text-warning">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Blueprint changed
        </Meta>
      )}
      <Button type="button" variant="ghost" size="xs" className="h-6 gap-1" aria-label={`Reset ${field}`} onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        Reset
      </Button>
    </span>
  );
}

/** A label row that ends in the field's Reset while the field is overridden. */
export function LabelRow({ children, reset }: { children: ReactNode; reset?: ReactNode }) {
  return <div className="flex items-center gap-2">{children}{reset}</div>;
}

/**
 * The frozen footer under a link's or copy's panel: Reset to Blueprint on the left, off while nothing is
 * overridden, and the host's own actions on the right.
 */
export function BlueprintFooter({ canReset, onReset, children }: { canReset: boolean; onReset: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t p-3">
      <Button type="button" variant="outline" size="sm" className="gap-1" disabled={!canReset} onClick={onReset}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Reset to Blueprint
      </Button>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
