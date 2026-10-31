import type { RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';

import { TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { SEGMENT_MOTION } from '@/components/ui/segmentMotion';
import { SEGMENT_X } from '@/components/ui/useCollapsingSegments';
import { labelShown, type SegmentFold, type SegmentLayout } from '@/lib/collapsingSegments';
import { MEASURE_LAYER } from '@/lib/measureLayer';
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
      className={cn('pointer-events-none absolute left-0 top-1 bottom-1 rounded-sm bg-background shadow-sm', animate && SEGMENT_MOTION.pill)}
      style={{ width: layout.widths[active], transform: `translateX(${layout.lefts[active]}px)` }}
    />
  );
}

/** A segment's icon and its label, which opens and closes with the step. It moves only once `animate`, so the first measured step lands without a slide. */
export function SegmentFace({ icon: Icon, label, shown, animate }: { icon: LucideIcon; label: string; shown: boolean; animate: boolean }) {
  return (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className={cn('grid', animate && SEGMENT_MOTION.label, shown ? 'ml-2 grid-cols-[1fr] opacity-100' : 'ml-0 grid-cols-[0fr] opacity-0')}>
        <span className="min-w-0 overflow-hidden">{label}</span>
      </span>
    </>
  );
}

/**
 * One segment of a collapsing strip: a toggle item or a tab. Once measured it takes its layout width, and
 * the pill replaces the trigger's own selected background.
 */
export function CollapsingSegment<V extends string>({ kind, option, index, active, fold, layout, ready, animate }: {
  kind: 'toggle' | 'tab';
  option: CollapsingSegmentOption<V>;
  index: number;
  active: number;
  fold: SegmentFold;
  layout: SegmentLayout;
  ready: boolean;
  animate: boolean;
}) {
  const shown = labelShown(fold, index, active);
  const props = {
    value: option.value,
    'aria-label': option.label,
    className: cn('relative z-10 shrink-0', SEGMENT_X, animate ? SEGMENT_MOTION.segment : 'transition-none'),
    style: ready ? { width: layout.widths[index] } : undefined,
    children: <SegmentFace icon={option.icon} label={option.label} shown={shown} animate={animate} />,
  };
  return (
    // The name stays on `aria-label`, drawn or not; the tip shows it where the label is folded away.
    <Tip tip={option.label} labelsChild={false} disabled={shown}>
      {kind === 'toggle'
        ? <ToggleGroupItem {...props} className={cn(props.className, ready && 'data-[state=on]:bg-transparent data-[state=on]:shadow-none')} />
        : <TabsTrigger {...props} className={cn(props.className, ready && 'data-[state=active]:bg-transparent data-[state=active]:shadow-none')} />}
    </Tip>
  );
}

/** Hidden rows of every segment, labeled and icon-only, that `useCollapsingSegments` reads. */
export function SegmentMeasure<V extends string>({ options, measureRef }: {
  options: readonly CollapsingSegmentOption<V>[];
  measureRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={measureRef} data-collapsing-measure="" aria-hidden className={MEASURE_LAYER}>
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
