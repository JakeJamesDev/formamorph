import { useState, type Ref } from 'react';
import { ArrowLeftRight, Lock, LockOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { HereMark } from '@/components/HereMark';
import { cn } from '@/lib/utils';
import { WorldInput } from '@/components/editor/WorldField';
import { fieldFrame } from '@/lib/historyField';
import { NEW_STOP_IDLE, switchAction, type ActionKind } from '@/lib/routineEditing';
import {
  blocked, CLOCK_ORDER, chancePercent, DAYPART_LABELS, daypartEnd, daypartStart, edgeDaypart, hhmm, idleText,
  parseHhmm, rangeText, snapToDayparts, timedCover, toWeight,
} from '@/lib/routineTime';
import { placesOf } from '@/lib/positionEngine';
import type { Daypart, ScheduleRange, ScheduleRow } from '@/types';
import { ACTION_TONE, ACTIONS } from './routineActions';
import { IdleField, LocationPicker, RoutinePlaceList, Token, UnconnectedFlag, type PlaceBook } from './RoutineFields';

const VERBS: Record<ActionKind, string> = { stay: 'stays at', wander: 'wanders', patrol: 'patrols', away: 'is away' };

const ALL_DAY = 'allDay';

/** A row's time editor. Dayparts by default; the swap button switches to hours. Stored minutes never change on a
 *  swap to hours, and a swap back snaps to the covering dayparts. A pick that touches another timed row is
 *  disabled, and a typed one is refused. */
export function RowTimeEditor({ time, asHours, onAsHours, others, onChange }: {
  time: ScheduleRow['time']; asHours: boolean; onAsHours: (hours: boolean) => void;
  /** The Start's other rows. */
  others: readonly ScheduleRow[];
  onChange: (time: ScheduleRow['time']) => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const covered = timedCover(others);
  const allDayTaken = others.some((r) => r.time === 'allDay');
  const range = time === 'allDay' ? null : time;

  const write = (next: ScheduleRange) => {
    if (blocked(covered, next)) { setNote('Those hours overlap another row'); return; }
    setNote(null);
    onChange(next);
  };
  const swap = () => {
    if (!range) return;
    if (!asHours) { setNote(null); onAsHours(true); return; }
    const { range: snapped, snapped: moved } = snapToDayparts(range);
    if (blocked(covered, snapped)) { setNote('The parts of the day around these hours overlap another row'); return; }
    onAsHours(false);
    setNote(moved ? 'Snapped to the parts of the day that cover those hours' : null);
    if (moved) onChange(snapped);
  };
  const pickFrom = (v: string) => {
    setNote(null);
    if (v === ALL_DAY) { onChange('allDay'); return; }
    const start = daypartStart(v as Daypart);
    const keepEnd = range && !blocked(covered, { start, end: range.end });
    onChange({ start, end: keepEnd ? range.end : daypartEnd(v as Daypart) });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Tip tip={asHours ? 'Use Time of Day' : 'Use Hours'}>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={!range} onClick={swap}
            aria-label={asHours ? 'Use Time of Day' : 'Use Hours'}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
        </Tip>
        {range && asHours ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <DateTimeField
              timeOnly label="From" value={hhmm(range.start)}
              hourDisabled={(h) => blocked(covered, { start: h * 60 + (range.start % 60), end: range.end })}
              onChange={(v) => write({ start: parseHhmm(v), end: range.end })}
            />
            <Meta>to</Meta>
            <DateTimeField
              timeOnly label="To" value={hhmm(range.end)}
              hourDisabled={(h) => blocked(covered, { start: range.start, end: h * 60 + (range.end % 60) })}
              onChange={(v) => write({ start: range.start, end: parseHhmm(v) })}
            />
          </div>
        ) : (
          <>
            <Select value={range ? edgeDaypart(range.start, 'start') ?? '' : ALL_DAY} onValueChange={pickFrom}>
              <SelectTrigger aria-label="From" className="h-8 min-w-0 flex-1 px-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DAY} disabled={allDayTaken}>All Day</SelectItem>
                {CLOCK_ORDER.map((d) => (
                  <SelectItem key={d} value={d} disabled={blocked(covered, { start: daypartStart(d), end: daypartEnd(d) })}>
                    {DAYPART_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {range && (
              <>
                <Meta>to</Meta>
                <Select value={edgeDaypart(range.end, 'end') ?? ''} onValueChange={(v) => { setNote(null); onChange({ start: range.start, end: daypartEnd(v as Daypart) }); }}>
                  <SelectTrigger aria-label="To" className="h-8 min-w-0 flex-1 px-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLOCK_ORDER.map((d) => (
                      <SelectItem key={d} value={d} disabled={blocked(covered, { start: range.start, end: daypartEnd(d) })}>
                        {DAYPART_LABELS[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </>
        )}
      </div>
      {note && <Meta as="p" role="status">{note}</Meta>}
    </div>
  );
}

/** The row's action as a Stay, Wander, Patrol or Away switch. */
function ActionEditor({ value, onChange }: { value: ActionKind; onChange: (kind: ActionKind) => void }) {
  return (
    <ToggleGroup
      type="single" className="grid w-full grid-cols-2" value={value} aria-label="Action"
      onValueChange={(v) => { if (v) onChange(v as ActionKind); }}
    >
      {ACTIONS.map(({ value: v, label, Icon }) => (
        <ToggleGroupItem key={v} value={v} className="gap-1.5 px-1.5"><Icon className="h-4 w-4" aria-hidden />{label}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** The row's locations: one for Stay, the shared list for Wander and Patrol. */
function PlacesEditor({ row, book, connected, onChange, field }: {
  row: ScheduleRow; book: PlaceBook; connected: readonly string[]; onChange: (row: ScheduleRow, typed: boolean) => void; field: string;
}) {
  const { action } = row;
  if (action.kind === 'away') return null;
  if (action.kind === 'stay') {
    return (
      <div className="space-y-1">
        <LocationPicker book={book} places={connected} value={action.place} ariaLabel="Location"
          onPick={(place) => onChange({ ...row, action: { ...action, place } }, false)} />
        {!connected.includes(action.place) && <Meta as="p" className="text-warning">{book.nameOf(action.place)} isn’t connected to the start location, so the game skips it</Meta>}
      </div>
    );
  }
  if (action.kind === 'wander') {
    const weights = action.places.map((p) => p.weight);
    return (
      <div className="space-y-2">
        <RoutinePlaceList
          listLabel="Wander Locations" items={action.places} book={book} connected={connected} unique
          make={(place) => ({ place, weight: 1 })}
          onChange={(places, typed) => onChange({ ...row, action: { ...action, places } }, typed)}
          right={(p, set, i) => (
            <span className="flex shrink-0 items-center gap-1" {...fieldFrame(field, 'weight', String(i))}>
              <WorldInput
                type="number" min={1} step={1} inputMode="numeric" className="h-8 w-14 px-2" aria-label={`Weight of ${book.nameOf(p.place)}`}
                value={p.weight} onChange={(e) => set({ ...p, weight: toWeight(e.target.value) }, true)}
              />
              <Meta className="w-9 text-right tabular-nums">{chancePercent(p.weight, weights)}%</Meta>
            </span>
          )}
        />
        <IdleField label="Waits" field={`${field}/idle`} minutes={action.idle} onChange={(idle, typed) => onChange({ ...row, action: { ...action, idle } }, typed)} />
      </div>
    );
  }
  return (
    <RoutinePlaceList
      listLabel="Patrol Stops" items={action.stops} book={book} connected={connected} numbered
      make={(place) => ({ place, idle: NEW_STOP_IDLE })}
      onChange={(stops, typed) => onChange({ ...row, action: { ...action, stops } }, typed)}
      right={(s, set, i) => <IdleField field={`${field}/stop/${i}`} label="Waits" minutes={s.idle} onChange={(idle, typed) => set({ ...s, idle }, typed)} />}
      after={action.stops.length > 1 ? <Meta>Then back to stop 1</Meta> : undefined}
    />
  );
}

/** One schedule row as a sentence. The time, the action and the locations each open their own editor. */
export function RoutineRow({ row, others, startPlace, book, connected, lockable = true, asHours, onAsHours, selected, onSelect, rowRef, onChange, onDelete, here }: {
  row: ScheduleRow; others: readonly ScheduleRow[]; startPlace: string; book: PlaceBook; connected: readonly string[];
  /** Whether the Strict lock shows. A Generic entity's rows keep their flag but hide it. */
  lockable?: boolean;
  /** Whether the row's time shows as hours. */
  asHours: boolean; onAsHours: (hours: boolean) => void;
  selected: boolean; onSelect: () => void; rowRef?: Ref<HTMLLIElement>;
  /** The name of the host's location, when this row names it: the row gets a mark. */
  here?: string;
  /** `typed` is true for a keystroke in a number box, which joins the typing run; a pick is its own Step. */
  onChange: (row: ScheduleRow, typed?: boolean) => void; onDelete: () => void;
}) {
  const timeText = row.time === 'allDay'
    ? (others.some((r) => r.time !== 'allDay') ? 'The rest of the day' : 'All day')
    : rangeText(row.time, asHours);
  const places = placesOf(row.action);
  const placeText = places.length === 0 ? 'no locations yet'
    : row.action.kind === 'patrol' ? places.map(book.nameOf).join(' → ') : places.map(book.nameOf).join(', ');
  const unconnected = places.some((p) => !connected.includes(p));
  const field = `routine/${row.id}`;
  const strictTip = row.strict ? 'Locked: can’t be called over or follow the player' : 'Unlocked: can be called over and follow the player';

  return (
    <li
      ref={rowRef} data-routine-row={row.id} aria-current={selected || undefined} onClickCapture={onSelect}
      className={cn('group flex items-start gap-1 rounded px-1 py-0.5 text-label leading-7 transition-colors', selected ? 'bg-accent/60' : 'hover:bg-muted/40')}
    >
      {/* As wide as the free-time line's icon, so the swatch centers on it and the two locks line up. */}
      <span className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
        <span className={cn('h-2.5 w-2.5 rounded-sm', ACTION_TONE[row.action.kind])} />
      </span>
      {lockable && (
        <Tip tip={strictTip}>
          <button
            type="button" className="mt-1.5 shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Locked" aria-pressed={!!row.strict}
            onClick={() => onChange({ ...row, strict: !row.strict })}
          >
            {row.strict ? <Lock className="h-4 w-4 text-warning" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
          </button>
        </Tip>
      )}
      <p className="min-w-0 flex-1">
        {here && <HereMark locationName={here} className="mr-1.5 align-middle" />}
        <Token wide label={`Time: ${timeText}`} editor={(
          <RowTimeEditor time={row.time} asHours={asHours} onAsHours={onAsHours} others={others} onChange={(time) => onChange({ ...row, time })} />
        )}>{timeText}</Token>
        {', '}
        <Token label={`Action: ${VERBS[row.action.kind]}`} editor={(
          <ActionEditor value={row.action.kind} onChange={(kind) => onChange({ ...row, action: switchAction(row.action, kind, startPlace) })} />
        )}>{VERBS[row.action.kind]}</Token>
        {row.action.kind !== 'away' && (
          <>
            {' '}
            <Token wide label={`Locations: ${placeText}`} editor={<PlacesEditor row={row} book={book} connected={connected} onChange={onChange} field={field} />}>
              {placeText}
            </Token>
          </>
        )}
        {unconnected && <span className="ml-1 inline-flex align-middle"><UnconnectedFlag /></span>}
        {row.action.kind === 'wander' && <>{', waiting '}{idleText(row.action.idle)}{' between moves'}</>}
        {row.action.kind === 'patrol' && places.length > 1 && ', then starts over'}
        .
      </p>
      <Tip tip={`Delete ${timeText}`}>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label={`Delete ${timeText}`} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tip>
    </li>
  );
}
