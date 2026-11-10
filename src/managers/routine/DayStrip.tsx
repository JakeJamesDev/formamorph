import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { CloudSun, Lock, Moon, Sun, SunDim, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { useWorldHistoryMovesOptional } from '@/contexts/worldRecorder';
import { MINUTES_PER_DAY } from '@/lib/gameClock';
import {
  CLOCK_ORDER, DAYPART_LABELS, daypartEnd, daypartStart, edgeText, moveEdge, moveRange, rangeText, stepEdge, stepRange, strip, STRIP_START,
  timedCover, timePositions, toStrip, type FreeRange, type RangeEdge,
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

/** Daypart icons centered on their stretch of the strip, full name in a tooltip. */
function DaypartAxis() {
  const spans = CLOCK_ORDER.flatMap((d) => strip({ start: daypartStart(d), end: daypartEnd(d) }).map(([a, b]) => ({ d, a, b })));
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

/** One end of a row's band. A drag or an arrow key moves it by the row's format; it never crosses a timed row. */
function EdgeHandle({ row, time, edge, asHours, covered, canFill, top, barRef, onGrab, onMove }: {
  row: ScheduleRow; time: ScheduleRow['time']; edge: RangeEdge; asHours: boolean; covered: readonly boolean[];
  /** Stretching the row over the whole strip makes it All Day. */
  canFill: boolean;
  /** The selected row's handles sit on top, so it wins a shared edge. */
  top: boolean;
  barRef: RefObject<HTMLDivElement | null>;
  onGrab: () => void; onMove: (next: ScheduleRow['time'], gesture: boolean) => void;
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

  const position = timePositions(time)[edge];
  const label = edgeText(time === 'allDay' ? STRIP_START : time[edge], edge, asHours);
  const timeText = time === 'allDay' ? 'All day' : rangeText(time, asHours);
  const same = (a: ScheduleRow['time'], b: ScheduleRow['time']) =>
    (a === 'allDay' || b === 'allDay' ? a === b : a.start === b.start && a.end === b.end);
  const write = (next: ScheduleRow['time'], gesture: boolean) => { if (!same(next, time)) onMove(next, gesture); };
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
    write(moveEdge(time, edge, at, asHours, covered, canFill), true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const direction = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (!direction) return;
    e.preventDefault();
    onGrab();
    write(stepEdge(time, edge, direction, asHours, covered, canFill), false);
  };

  return (
    <div
      {...{ [STRIP_PART]: '' }}
      role="slider" tabIndex={0} aria-label={`${edge === 'start' ? 'Start' : 'End'} of ${timeText}`}
      aria-valuemin={0} aria-valuemax={MINUTES_PER_DAY} aria-valuenow={position} aria-valuetext={label}
      data-row={row.id} data-edge={edge}
      className={cn(
        'group/handle absolute inset-y-0 flex w-3 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center rounded-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        top ? 'z-20' : 'z-10',
      )}
      style={{ left: pct(position) }}
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

/** Pointer travel, in pixels, before a press on a band becomes a move. */
const MOVE_SLOP = 4;

const sameRange = (a: ScheduleRange, b: ScheduleRange) => a.start === b.start && a.end === b.end;

/** The Start's day on a 24-hour strip that begins at Dawn: a band per row in its action's color, the All-day row underneath, free time
 *  hatched. A band selects its row, a gap adds a row over it, each timed band's ends drag, and a timed band drags whole. */
export function DayStrip({ rows, free, asHoursOf, selected, onSelect, onFill, onMove }: {
  rows: readonly ScheduleRow[]; free: readonly FreeRange[];
  asHoursOf: (row: ScheduleRow) => boolean;
  selected: string | null;
  onSelect: (rowId: string) => void;
  onFill: (time: ScheduleRow['time']) => void;
  /** `gesture` is true for a pointer drag, which the strip groups into one Step. */
  onMove: (rowId: string, time: ScheduleRow['time'], gesture: boolean) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const history = useWorldHistoryMovesOptional();
  // A band's move, measured from where the press began so the row lands the same whatever path the pointer took.
  const moving = useRef<{ rowId: string; x: number; from: ScheduleRange; grouped: boolean } | null>(null);
  const endMove = () => {
    if (moving.current?.grouped) void history?.endGroup();
    moving.current = null;
  };
  // A strip that unmounts mid-move closes its Step.
  useEffect(() => () => { if (moving.current?.grouped) void history?.endGroup(); }, [history]);
  const others = (rowId: string) => timedCover(rows.filter((r) => r.id !== rowId));
  const grabBand = (e: PointerEvent<HTMLButtonElement>, row: ScheduleRow) => {
    if (e.button !== 0 || row.time === 'allDay') return;
    // The bar takes the pointer: a band that wraps is two pieces, and a move can merge them under the press.
    barRef.current?.setPointerCapture?.(e.pointerId);
    onSelect(row.id);
    moving.current = { rowId: row.id, x: e.clientX, from: row.time, grouped: false };
  };
  const dragBand = (e: PointerEvent<HTMLDivElement>) => {
    const move = moving.current;
    const rect = barRef.current?.getBoundingClientRect();
    const row = move && rows.find((r) => r.id === move.rowId);
    if (!move || !row || row.time === 'allDay' || !rect || rect.width === 0) return;
    const travel = e.clientX - move.x;
    if (!move.grouped && Math.abs(travel) < MOVE_SLOP) return;
    if (!move.grouped && history) { history.beginGroup('Move Routine Time'); move.grouped = true; }
    const next = moveRange(move.from, (travel / rect.width) * MINUTES_PER_DAY, asHoursOf(row), others(row.id));
    if (!sameRange(next, row.time)) onMove(row.id, next, true);
  };
  const stepBand = (e: KeyboardEvent<HTMLButtonElement>, row: ScheduleRow) => {
    const direction = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!direction || row.time === 'allDay') return;
    e.preventDefault();
    const next = stepRange(row.time, direction, asHoursOf(row), others(row.id));
    if (!sameRange(next, row.time)) { onSelect(row.id); onMove(row.id, next, false); }
  };
  const timed = rows.some((r) => r.time !== 'allDay');
  const timeOf = (row: ScheduleRow) => (row.time === 'allDay' ? (timed ? 'The rest of the day' : 'All day') : rangeText(row.time, asHoursOf(row)));

  return (
    <div className="space-y-0.5" aria-label="Day" role="group">
      <DaypartAxis />
      <div className="relative">
        <div
          ref={barRef} className="relative h-6 touch-none overflow-hidden rounded bg-muted/40"
          onPointerMove={dragBand} onPointerUp={endMove} onPointerCancel={endMove} onLostPointerCapture={endMove}
        >
          {CLOCK_ORDER.map((d) => <span key={d} aria-hidden className="absolute inset-y-0 w-px bg-border" style={{ left: pct(toStrip(daypartStart(d))) }} />)}
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
                  onPointerDown={(e) => grabBand(e, row)} onKeyDown={(e) => stepBand(e, row)}
                  className={cn(
                    'absolute inset-y-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    ACTION_TONE[row.action.kind], row.time === 'allDay' ? 'opacity-50' : 'cursor-grab active:cursor-grabbing',
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
          // An All-day row under timed rows is the rest of the day, with no ends of its own to drag.
          if (row.time === 'allDay' && timed) return null;
          const covered = timedCover(rows.filter((r) => r.id !== row.id));
          const canFill = !rows.some((r) => r.id !== row.id && r.time === 'allDay');
          return (['start', 'end'] as const).map((edge) => (
            <EdgeHandle
              key={`${row.id}-${edge}`} row={row} time={row.time} edge={edge} asHours={asHoursOf(row)} covered={covered} canFill={canFill}
              top={row.id === selected} barRef={barRef}
              onGrab={() => onSelect(row.id)} onMove={(next, gesture) => onMove(row.id, next, gesture)}
            />
          ));
        })}
      </div>
    </div>
  );
}
