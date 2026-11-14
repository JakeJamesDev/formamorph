import type { ReactNode } from 'react';
import { Tip } from '@/components/ui/tooltip';

/**
 * Shows `reason` as the tooltip of a disabled control, or the control alone when nothing blocks it.
 * A disabled button takes no hover, so the focusable span carries the tooltip.
 */
export function BlockedActionTip({ reason, children }: { reason: string | null; children: ReactNode }) {
  if (!reason) return <>{children}</>;
  return (
    <Tip tip={reason} labelsChild={false}>
      <span tabIndex={0} aria-description={reason} className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </span>
    </Tip>
  );
}
