import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The side a drill level enters from: `right` going deeper, `left` going back, `null` on first show. */
export type SlideFrom = 'right' | 'left' | null;

/** One level of a drill-down menu. Key it by level so each new level replays the slide. */
export function DrillSlide({ from, children }: { from: SlideFrom; children: ReactNode }) {
  return (
    <div
      className={cn(
        from && 'animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none',
        from === 'right' && 'slide-in-from-right-8',
        from === 'left' && 'slide-in-from-left-8',
      )}
    >
      {children}
    </div>
  );
}
