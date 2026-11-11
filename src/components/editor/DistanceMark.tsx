import { cn } from '@/lib/utils';
import type { ConnectionDistance } from '@/lib/locationCanvas';

// A dotted sine wave with one hump per 8px, longer than any slot; the svg clips it.
const WAVE = `M0 4${' q4 -5 8 0 t8 0'.repeat(8)}`;

const WORDS: Record<ConnectionDistance, string> = { nearby: 'Nearby', far: 'Far' };

/**
 * A Connection's distance as a line and its word, in one fixed width, so the shorter word gets the longer
 * line: a short straight line for Nearby, a dotted wave for Far. It draws in the current text color.
 */
export function DistanceMark({ distance, className }: { distance: ConnectionDistance; className?: string }) {
  return (
    <span data-distance-mark={distance} className={cn('inline-flex w-[3.75rem] shrink-0 items-center gap-1 text-helper', className)}>
      <svg className="h-2 min-w-0 flex-1" aria-hidden="true">
        {distance === 'far'
          ? <path d={WAVE} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 2.6" />
          : <line x1="1" y1="4" x2="100" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
      {WORDS[distance]}
    </span>
  );
}
