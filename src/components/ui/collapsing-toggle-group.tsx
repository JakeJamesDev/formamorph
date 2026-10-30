import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { SegmentFace, SegmentMeasure, SegmentPill, type CollapsingSegmentOption } from '@/components/ui/collapsing-segments';
import { SEGMENT_X, useCollapsingSegments } from '@/components/ui/useCollapsingSegments';
import type { SegmentFold } from '@/lib/collapsingSegments';
import { cn } from '@/lib/utils';

export type CollapsingToggleOption<V extends string> = CollapsingSegmentOption<V>;

interface CollapsingToggleGroupProps<V extends string> {
  options: readonly CollapsingToggleOption<V>[];
  value: V;
  onValueChange: (value: V) => void;
  'aria-label': string;
  className?: string;
  /** A step chosen by the host, such as a top bar that folds its controls in order. Unset, the group picks by its own room. */
  fold?: SegmentFold;
  /** Receives the group's width at each step whenever the measurements change. */
  onStepWidths?: (widths: Record<SegmentFold, number>) => void;
}

/**
 * A pick-one segmented control that shows every label while it fits. When it doesn't, only the selected
 * option keeps its label, and with less room still, every option shows its icon alone. One pill slides to
 * the selection.
 *
 * It fills its parent's width and folds by that room, not by the viewport, unless the host passes `fold`.
 */
export function CollapsingToggleGroup<V extends string>({ options, value, onValueChange, className, fold: hostFold, onStepWidths, ...aria }: CollapsingToggleGroupProps<V>) {
  const active = Math.max(0, options.findIndex((o) => o.value === value));
  const { rootRef, measureRef, ready, animate, fold, layout, minWidth } = useCollapsingSegments({
    labels: options.map((o) => o.label), active, fold: hostFold, onStepWidths,
  });

  return (
    <div ref={rootRef} data-collapsing-root="" className={cn('relative flex w-full min-w-0 [contain:inline-size]', className)} style={{ minWidth }}>
      <ToggleGroup
        type="single"
        value={value}
        // A single ToggleGroup clears its value when the active item is pressed again; a value is always required.
        onValueChange={(v) => { if (v) onValueChange(v as V); }}
        className="relative"
        {...aria}
      >
        {ready && <SegmentPill layout={layout} active={active} animate={animate} />}
        {options.map(({ value: optionValue, label, icon }, i) => {
          const shown = fold === 'full' || (fold === 'active' && i === active);
          return (
            <Tip key={optionValue} tip={label} labelsChild={false} disabled={shown}>
              <ToggleGroupItem
                value={optionValue}
                className={cn('relative z-10', SEGMENT_X, ready && 'data-[state=on]:bg-transparent data-[state=on]:shadow-none')}
              >
                <SegmentFace icon={icon} label={label} shown={shown} animate={animate} />
              </ToggleGroupItem>
            </Tip>
          );
        })}
      </ToggleGroup>
      <SegmentMeasure options={options} measureRef={measureRef} />
    </div>
  );
}
