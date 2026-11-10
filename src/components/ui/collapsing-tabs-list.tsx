import { TabsList } from '@/components/ui/tabs';
import { CollapsingSegment, SegmentMeasure, SegmentPill, type SegmentOption } from '@/components/ui/collapsing-segments';
import { useCollapsingSegments } from '@/components/ui/useCollapsingSegments';
import { iconlessFold } from '@/lib/collapsingSegments';
import type { SwipeProgress } from '@/lib/swipeProgress';
import { cn } from '@/lib/utils';

/**
 * A tab strip that folds like `CollapsingToggleGroup`: every label, then the selected tab's, then icons
 * alone. It goes inside a `Tabs` root, and `value` is that root's tab.
 *
 * The tabs stretch to fill the row. With `hug`, the strip instead takes its full-label width as a flex
 * basis, shrinks in a tight row down to its icons, and centers its tabs.
 */
export function CollapsingTabsList<V extends string>({ tabs, value, className, hug = false, follow, 'aria-label': ariaLabel }: {
  tabs: readonly SegmentOption<V>[];
  value: V;
  className?: string;
  hug?: boolean;
  /** A swiped strip of this strip's panels, which the pill tracks while it moves. */
  follow?: SwipeProgress;
  'aria-label': string;
}) {
  const active = Math.max(0, tabs.findIndex((t) => t.value === value));
  const { rootRef, measureRef, ready, animate, fold, layout, minWidth, fullWidth } = useCollapsingSegments({
    labels: tabs.map((t) => t.label), active, fill: !hug, fold: iconlessFold(tabs),
  });

  return (
    <div
      ref={rootRef}
      data-collapsing-root=""
      className={cn('relative flex min-w-0 [contain:inline-size]', hug ? 'justify-center' : 'w-full', className)}
      style={{ minWidth, ...(hug && fullWidth !== undefined && { flex: `0 1 ${fullWidth}px` }) }}
    >
      <TabsList aria-label={ariaLabel} className={cn('relative flex justify-start', !hug && 'w-full')}>
        {ready && <SegmentPill layout={layout} active={active} animate={animate} follow={follow} />}
        {tabs.map((tab, i) => (
          <CollapsingSegment
            key={tab.value}
            kind="tab"
            option={tab}
            index={i}
            active={active}
            fold={fold}
            layout={layout}
            ready={ready}
            animate={animate}
          />
        ))}
      </TabsList>
      <SegmentMeasure options={tabs} measureRef={measureRef} />
    </div>
  );
}
