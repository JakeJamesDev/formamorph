import { useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { segmentFold, segmentLayout } from '@/lib/collapsingSegments';
import { cn } from '@/lib/utils';

export interface CollapsingToggleOption<V extends string> {
  value: V;
  label: string;
  icon: LucideIcon;
}

interface CollapsingToggleGroupProps<V extends string> {
  options: readonly CollapsingToggleOption<V>[];
  value: V;
  onValueChange: (value: V) => void;
  'aria-label': string;
  className?: string;
}

/** The group's `p-1`, on each side. */
const INSET = 4;
/** Horizontal metrics shared by the live segments and the hidden measuring copies. */
const SEGMENT_X = 'px-3 text-label font-medium whitespace-nowrap';
const MOTION = 'duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none';

interface Measured {
  full: number[];
  icon: number[];
  room: number;
}

const sameNumbers = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);

/**
 * A pick-one segmented control that shows every label while it fits. When it doesn't, only the selected
 * option keeps its label, and with less room still, every option shows its icon alone. One pill slides to
 * the selection.
 *
 * It fills its parent's width and folds by that room, not by the viewport.
 */
export function CollapsingToggleGroup<V extends string>({ options, value, onValueChange, className, ...aria }: CollapsingToggleGroupProps<V>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [animate, setAnimate] = useState(false);
  const labelKey = options.map((o) => o.label).join('\u0000');

  useLayoutEffect(() => {
    const root = rootRef.current;
    const rows = measureRef.current?.children;
    if (!root || !rows || rows.length < 2) return;
    const widths = (row: Element) => Array.from(row.children, (c) => (c as HTMLElement).offsetWidth);
    const read = () => {
      const next = { full: widths(rows[0]), icon: widths(rows[1]), room: root.offsetWidth };
      setMeasured((held) => (held && held.room === next.room && sameNumbers(held.full, next.full) && sameNumbers(held.icon, next.icon) ? held : next));
    };
    read();
    // jsdom has no ResizeObserver in every suite; the first read is what those runs get.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    observer?.observe(root);
    observer?.observe(rows[0]);
    return () => observer?.disconnect();
  }, [labelKey]);

  // The pill lands without a slide on its first measured frame, then animates from there.
  const ready = !!measured && measured.full.some((w) => w > 0);
  useLayoutEffect(() => {
    if (!ready || animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [ready, animate]);

  const active = Math.max(0, options.findIndex((o) => o.value === value));
  const full = measured?.full ?? [];
  const icon = measured?.icon ?? [];
  const fold = ready && measured !== null && measured.room > 0 ? segmentFold(full, icon, measured.room, INSET) : 'full';
  const layout = segmentLayout(full, icon, active, fold, INSET);
  const minWidth = ready ? segmentLayout(full, icon, active, 'icons', INSET).total : undefined;

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
        {ready && (
          <span
            aria-hidden
            data-collapsing-pill=""
            className={cn('pointer-events-none absolute left-0 top-1 bottom-1 rounded-sm bg-background shadow-sm', animate && cn('transition-[transform,width]', MOTION))}
            style={{ width: layout.widths[active], transform: `translateX(${layout.lefts[active]}px)` }}
          />
        )}
        {options.map(({ value: optionValue, label, icon: Icon }, i) => {
          const shown = fold === 'full' || (fold === 'active' && i === active);
          return (
            <Tip key={optionValue} tip={label} labelsChild={false} disabled={shown}>
              <ToggleGroupItem
                value={optionValue}
                className={cn('relative z-10', SEGMENT_X, ready && 'data-[state=on]:bg-transparent data-[state=on]:shadow-none')}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className={cn('grid transition-[grid-template-columns,opacity,margin-left]', MOTION, shown ? 'ml-2 grid-cols-[1fr] opacity-100' : 'ml-0 grid-cols-[0fr] opacity-0')}>
                  <span className="min-w-0 overflow-hidden">{label}</span>
                </span>
              </ToggleGroupItem>
            </Tip>
          );
        })}
      </ToggleGroup>
      <div ref={measureRef} data-collapsing-measure="" aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden">
        {[true, false].map((withLabel) => (
          <div key={String(withLabel)} className="flex w-max">
            {options.map(({ value: optionValue, label, icon: Icon }) => (
              <span key={optionValue} className={cn('inline-flex items-center', SEGMENT_X)}>
                <Icon className="h-4 w-4 shrink-0" />
                {withLabel && <span className="ml-2">{label}</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
