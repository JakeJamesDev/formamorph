import { Meta } from '@/components/ui/typography';

export interface BarSegment {
  key: string;
  label: string;
  value: number;
  /** Any CSS color. */
  color: string;
}

export interface BarMark {
  /** A fraction of the scale. */
  at: number;
  label: string;
}

/**
 * Parts of one whole on a flat track, with dashed marks and a legend of every segment. The track is the
 * scale; what the segments leave is empty track. Segments past the scale squeeze to fit a full bar.
 * The bar is hidden from assistive technology, so the legend and a table nearby hold the figures.
 */
export function SegmentedBar({ scale, segments, marks = [], format, label, legend = true }: {
  scale: number;
  segments: readonly BarSegment[];
  marks?: readonly BarMark[];
  format: (value: number) => string;
  /** Names the legend. */
  label: string;
  /** False leaves the legend to the caller, which then lists every segment with its color. */
  legend?: boolean;
}) {
  const whole = Math.max(scale, segments.reduce((total, segment) => total + segment.value, 0), 1);
  return (
    <div className="grid gap-3 min-w-0">
      <div aria-hidden="true" className={`relative ${marks.length > 0 ? 'pt-5' : ''}`}>
        <div className="flex h-[22px] gap-0.5 overflow-hidden rounded-full bg-muted">
          {segments.filter((segment) => segment.value > 0).map((segment) => (
            <div
              key={segment.key}
              data-segment={segment.key}
              className="h-full min-w-px shrink"
              style={{ width: `${(segment.value / whole) * 100}%`, backgroundColor: segment.color }}
            />
          ))}
        </div>
        {marks.map((mark) => (
          <div key={mark.at} data-mark={mark.at} className="absolute bottom-0 top-0" style={{ left: `${Math.min(mark.at, 1) * 100}%` }}>
            <Meta className="absolute top-0 -translate-x-1/2 tabular-nums">{mark.label}</Meta>
            <div className="absolute bottom-0 top-5 -translate-x-1/2 border-l-2 border-dashed border-foreground/70" />
          </div>
        ))}
      </div>
      {legend && (
        <ul aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-4 gap-y-1.5 text-label">
          {segments.map((segment) => (
            <li key={segment.key} data-legend={segment.key} className="flex min-w-0 items-center gap-2">
              <SegmentSwatch color={segment.color} />
              <span className="min-w-0 truncate">{segment.label}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{format(segment.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A segment's color as a small square, for a legend or a table row that names the segment. */
export function SegmentSwatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />;
}
