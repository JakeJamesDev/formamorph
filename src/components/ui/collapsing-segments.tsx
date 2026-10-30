import type { RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';

import { SEGMENT_MOTION, SEGMENT_X } from '@/components/ui/useCollapsingSegments';
import type { SegmentLayout } from '@/lib/collapsingSegments';
import { cn } from '@/lib/utils';

export interface CollapsingSegmentOption<V extends string> {
  value: V;
  label: string;
  icon: LucideIcon;
}

/** The one pill that slides to the selected segment. */
export function SegmentPill({ layout, active, animate }: { layout: SegmentLayout; active: number; animate: boolean }) {
  return (
    <span
      aria-hidden
      data-collapsing-pill=""
      className={cn('pointer-events-none absolute left-0 top-1 bottom-1 rounded-sm bg-background shadow-sm', animate && cn('transition-[transform,width]', SEGMENT_MOTION))}
      style={{ width: layout.widths[active], transform: `translateX(${layout.lefts[active]}px)` }}
    />
  );
}

/** A segment's icon and its label, which opens and closes with the step. It moves only once `animate`, so the first measured step lands without a slide. */
export function SegmentFace({ icon: Icon, label, shown, animate }: { icon: LucideIcon; label: string; shown: boolean; animate: boolean }) {
  return (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className={cn('grid', animate && cn('transition-[grid-template-columns,opacity,margin-left]', SEGMENT_MOTION), shown ? 'ml-2 grid-cols-[1fr] opacity-100' : 'ml-0 grid-cols-[0fr] opacity-0')}>
        <span className="min-w-0 overflow-hidden">{label}</span>
      </span>
    </>
  );
}

/** Hidden rows of every segment, labeled and icon-only, that `useCollapsingSegments` reads. */
export function SegmentMeasure<V extends string>({ options, measureRef }: {
  options: readonly CollapsingSegmentOption<V>[];
  measureRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={measureRef} data-collapsing-measure="" aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden">
      {[true, false].map((withLabel) => (
        <div key={String(withLabel)} className="flex w-max">
          {options.map(({ value, label, icon: Icon }) => (
            <span key={value} className={cn('inline-flex items-center', SEGMENT_X)}>
              <Icon className="h-4 w-4 shrink-0" />
              {withLabel && <span className="ml-2">{label}</span>}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
