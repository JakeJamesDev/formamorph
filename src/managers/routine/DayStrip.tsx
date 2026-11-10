import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { CloudSun, Lock, Moon, Sun, SunDim, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { useWorldHistoryMovesOptional } from '@/contexts/worldRecorder';
import { MINUTES_PER_DAY } from '@/lib/gameClock';
import {
  CLOCK_ORDER, DAYPART_LABELS, daypartEnd, daypartStart, edgePositions, edgeText, moveEdge, rangeText, stepEdge, strip,
  timedCover, type FreeRange, type RangeEdge,
} from '@/lib/routineTime';
import { cn } from '@/lib/utils';
import type { Daypart, ScheduleRange, ScheduleRow } from '@/types';
import { ACTION_TONE, ACTIONS } from './routineActions';

const DAYPART_ICON: Record<Daypart, LucideIcon> = {
  night: Moon, dawn: Sunrise, morning: SunDim, midday: Sun, afternoon: CloudSun, evening: Sunset,
};

/** Marks the strip's bands, handles and gaps, which keep the row selection when pressed. */
export const STRIP_PART = 'data-routine-strip';

const pct = (m: number) => `${(m / MINUTES_PER_DAY) * 100}%`;

/** Daypart icons centered on their stretch of the day, full name in a tooltip. Night wraps, so it shows twice. */
function DaypartAxis() {
  const spans = CLOCK_ORDER.flatMap((d) => {
    const a = daypartStart(d); const b = daypartEnd(d);
    return a < b ? [{ d, a, b }] : [{ d, a, b: MINUTES_PER_DAY }, { d, a: 0, b }];
  });
  return (
    <div className="relative h-5">
      {spans.map(({ d, a, b }) => {
        const Icon = DAYPART_ICON[d];
        return (
          <Tip key={`${d}-${a}`} tip={DAYPART_LABELS[d]}>
            <span
              role="img" aria-label={DAYPART_LABELS[d]}
              className="absolute top-0 flex h-5 -translate-x-1/2 items-center text-muted-foreground" style={{ left: pct((a + b) / 2) }}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
          </Tip>
        );
      })}
    </div>
  );
}

/** One end of a timed row's band. A drag or an arrow key moves it by the row's format; it never crosses a timed row. */
function EdgeHandle({ row, range, edge, asHours, covered, top, barRef, onGrab, onMove }: {
  row: ScheduleRow; range: ScheduleRange; edge: RangeEdge; asHours: boolean; covered: readonly boolean[];
  /** The selected row's handles sit on top, so it wins a shared edge. */
  top: boolean;
  barRef: RefObject<HTMLDivElement | null>;
  onGrab: () => void; onMove: (next: ScheduleRange, gesture: boolean) => void;
}) {
  const history = useWorldHistoryMovesOptional();
  const [dragging, setDragging] = useState(false);
  const grouped = useRef(false);
  const endGroup = () => {
    if (grouped.current) { grouped.current = false; void history?.endGroup(); }
    setDragging(false);
  };
  // A handle that unmounts mid-drag closes its Step.
  useEffect(() => () => { if (grouped.current) void history?.endGroup(); }, [history]);

  const minute = range[edge];
  const label = edgeText(minute, edge, asHours);
  const write = (next: ScheduleRange, gesture: boolean) => {
    if (next.start !== range.start || next.end !== range.end) onMove(next, gesture);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Stopping the default keeps text from selecting mid-drag, and with it the focus a press gives, so focus by hand.
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onGrab();
    history?.beginGroup('Move Routine Time');
    grouped.current = !!history;
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!dragging || !rect || rect.width === 0) return;
    const at = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) * MINUTES_PER_DAY;
    write(moveEdge(range, edge, at, asHours, covered), true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const direction = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (!direction) return;
    e.preventDefault();
    onGrab();
    write(stepEdge(range, edge, direction, asHours, covered), false);
  };

  return (
    <div
      {...{ [STRIP_PART]: '' }}
      role="slider" tabIndex={0} aria-label={`${edge === 'start' ? 'Start' : 'End'} of ${rangeText(range, asHours)}`}
      aria-valuemin={0} aria-valuemax={MINUTES_PER_DAY} aria-valuenow={edgePositions(range)[edge]} aria-valuetext={label}
      data-row={row.id} data-edge={edge}
      className={cn(
        'group/handle absolute inset-y-0 flex w-3 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        top ? 'z-20' : 'z-10',
      )}
      style={{ left: pct(edgePositions(range)[edge]) }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={endGroup} onPointerCancel={endGroup} onLostPointerCapture={endGroup}
      onKeyDown={onKeyDown}
    >
      <span className={cn('h-4 w-1 rounded-full bg-background shadow ring-1 ring-foreground/50', dragging && 'h-5 bg-primary ring-primary')} />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute bottom-full mb-1 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-meta text-popover-foreground shadow ring-1 ring-border',
          dragging ? 'block' : 'hidden group-hover/handle:block group-focus-visible/handle:block',
        )}
      >
        {label}
      </span>
    </div>
  );
}

const actionLabel = (row: ScheduleRow) => ACTIONS.find((a) => a.value === row.action.kind)?.label ?? '';

/** The Start's day on a 24-hour strip: a band per row in its action's color, the All-day row underneath, free time
 *  hatched. A band selects its row, a gap adds a row over it, and each timed band's ends drag. */
export function DayStrip({ rows, free, asHoursOf, selected, onSelect, onFill, onMove }: {
  rows: readonly ScheduleRow[]; free: readonly FreeRange[];
  asHoursOf: (row: ScheduleRow) => boolean;
  selected: string | null;
  onSelect: (rowId: string) => void;
  onFill: (time: ScheduleRow['time']) => void;
  /** `gesture` is true for a pointer drag, which the strip groups into one Step. */
  onMove: (rowId: string, range: ScheduleRange, gesture: boolean) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const timed = rows.some((r) => r.time !== 'allDay');
  const timeOf = (row: ScheduleRow) => (row.time === 'allDay' ? (timed ? 'The rest of the day' : 'All day') : rangeText(row.time, asHoursOf(row)));

  return (
    <div className="space-y-0.5" aria-label="Day" role="group">
      <DaypartAxis />
      <div className="relative">
        <div ref={barRef} className="relative h-6 overflow-hidden rounded bg-muted/40">
          {CLOCK_ORDER.map((d) => <span key={d} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: pct(daypartStart(d)) }} />)}
          {free.flatMap((gap) => {
            const range: ScheduleRange = { start: gap.start, end: gap.end % MINUTES_PER_DAY };
            const time: ScheduleRow['time'] = gap.wholeDay ? 'allDay' : range;
            const text = gap.wholeDay ? 'the whole day' : rangeText(range);
            const pieces: [number, number][] = gap.wholeDay ? [[0, MINUTES_PER_DAY]] : strip(range);
            return pieces.map(([a, b]) => (
              <Tip key={`gap-${a}`} tip={`Add a Stay for ${text}`}>
                <button
                  type="button" {...{ [STRIP_PART]: '' }} onClick={() => onFill(time)}
                  className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,hsl(var(--muted-foreground)/0.35)_0_4px,transparent_4px_8px)] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  style={{ left: pct(a), width: pct(b - a) }}
                />
              </Tip>
            ));
          })}
          {rows.flatMap((row) => {
            const pieces: [number, number][] = row.time === 'allDay' ? [[0, MINUTES_PER_DAY]] : strip(row.time);
            return pieces.map(([a, b], i) => (
              <Tip key={`${row.id}-${i}`} tip={`${timeOf(row)}: ${actionLabel(row)}${row.strict ? ', Locked' : ''}`}>
                <button
                  type="button" {...{ [STRIP_PART]: '' }} data-band={row.id} aria-pressed={selected === row.id}
                  aria-label={`${timeOf(row)}: ${actionLabel(row)}`}
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    'absolute inset-y-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    ACTION_TONE[row.action.kind], row.time === 'allDay' && 'opacity-50',
                    selected === row.id && 'ring-2 ring-inset ring-primary',
                  )}
                  style={{ left: pct(a), width: pct(b - a), zIndex: row.time === 'allDay' ? 0 : 1 }}
                >
                  {row.strict && <Lock className="h-3 w-3 text-foreground" aria-hidden />}
                </button>
              </Tip>
            ));
          })}
        </div>
        {rows.map((row) => {
          if (row.time === 'allDay') return null;
          const range = row.time;
          const covered = timedCover(rows.filter((r) => r.id !== row.id));
          return (['start', 'end'] as const).map((edge) => (
            <EdgeHandle
              key={`${row.id}-${edge}`} row={row} range={range} edge={edge} asHours={asHoursOf(row)} covered={covered}
              top={row.id === selected} barRef={barRef}
              onGrab={() => onSelect(row.id)} onMove={(next, gesture) => onMove(row.id, next, gesture)}
            />
          ));
        })}
      </div>
    </div>
  );
}
