import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tip } from '@/components/ui/tooltip';
import { SegmentFace, SegmentMeasure, SegmentPill, type CollapsingSegmentOption } from '@/components/ui/collapsing-segments';
import { SEGMENT_MOTION, SEGMENT_X, useCollapsingSegments } from '@/components/ui/useCollapsingSegments';
import { cn } from '@/lib/utils';

/**
 * A tab strip that folds like `CollapsingToggleGroup`: every label, then the selected tab's, then icons
 * alone. It goes inside a `Tabs` root, and `value` is that root's tab.
 *
 * The tabs stretch to fill the row. With `hug`, the strip instead takes its full-label width as a flex
 * basis, shrinks in a tight row down to its icons, and centers its tabs.
 */
export function CollapsingTabsList<V extends string>({ tabs, value, className, hug = false, 'aria-label': ariaLabel }: {
  tabs: readonly CollapsingSegmentOption<V>[];
  value: V;
  className?: string;
  hug?: boolean;
  'aria-label': string;
}) {
  const active = Math.max(0, tabs.findIndex((t) => t.value === value));
  const { rootRef, measureRef, ready, animate, fold, layout, minWidth, fullWidth } = useCollapsingSegments({
    labels: tabs.map((t) => t.label), active, fill: !hug,
  });

  return (
    <div
      ref={rootRef}
      data-collapsing-root=""
      className={cn('relative flex min-w-0 [contain:inline-size]', hug ? 'justify-center' : 'w-full', className)}
      style={{ minWidth, ...(hug && fullWidth !== undefined && { flex: `0 1 ${fullWidth}px` }) }}
    >
      <TabsList aria-label={ariaLabel} className={cn('relative flex justify-start', !hug && 'w-full')}>
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
