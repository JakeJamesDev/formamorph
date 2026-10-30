import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tip } from '@/components/ui/tooltip';
import { SegmentFace, SegmentMeasure, SegmentPill, type CollapsingSegmentOption } from '@/components/ui/collapsing-segments';
import { SEGMENT_MOTION, SEGMENT_X, useCollapsingSegments } from '@/components/ui/useCollapsingSegments';
import { cn } from '@/lib/utils';

/**
 * A tab strip that folds like `CollapsingToggleGroup`: every label, then the selected tab's, then icons
 * alone. The tabs stretch to fill the row. It goes inside a `Tabs` root, and `value` is that root's tab.
 */
export function CollapsingTabsList<V extends string>({ tabs, value, className, 'aria-label': ariaLabel }: {
  tabs: readonly CollapsingSegmentOption<V>[];
  value: V;
  className?: string;
  'aria-label': string;
}) {
  const active = Math.max(0, tabs.findIndex((t) => t.value === value));
  const { rootRef, measureRef, ready, animate, fold, layout, minWidth } = useCollapsingSegments({
    labels: tabs.map((t) => t.label), active, fill: true,
  });

  return (
    <div ref={rootRef} data-collapsing-root="" className={cn('relative flex w-full min-w-0 [contain:inline-size]', className)} style={{ minWidth }}>
      <TabsList aria-label={ariaLabel} className="relative flex w-full justify-start">
        {ready && <SegmentPill layout={layout} active={active} animate={animate} />}
        {tabs.map(({ value: tabValue, label, icon }, i) => {
          const shown = fold === 'full' || (fold === 'active' && i === active);
          return (
            // The name stays on `aria-label`, drawn or not; the tip shows it where the label is folded away.
            <Tip key={tabValue} tip={label} labelsChild={false} disabled={shown}>
              <TabsTrigger
                value={tabValue}
                aria-label={label}
                className={cn(
                  'relative z-10 shrink-0', SEGMENT_X,
                  ready && 'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                  animate ? cn('transition-[width,color]', SEGMENT_MOTION) : 'transition-none',
                )}
                style={ready ? { width: layout.widths[i] } : undefined}
              >
                <SegmentFace icon={icon} label={label} shown={shown} animate={animate} />
              </TabsTrigger>
            </Tip>
          );
        })}
      </TabsList>
      <SegmentMeasure options={tabs} measureRef={measureRef} />
    </div>
  );
}
