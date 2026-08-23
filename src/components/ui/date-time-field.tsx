import { useId, useMemo, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { DayPicker, type ChevronProps, type DropdownProps } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import 'react-day-picker/style.css';

/**
 * The calendar in the app's own palette.
 *
 * react-day-picker draws itself from CSS variables, so the theme is a handful of token references
 * rather than a re-implementation of its grid — which also means both themes follow the app's without a
 * second declaration.
 */
const CALENDAR_THEME = {
  '--rdp-accent-color': 'hsl(var(--primary))',
  '--rdp-accent-background-color': 'hsl(var(--accent))',
  '--rdp-today-color': 'hsl(var(--primary))',
  '--rdp-day-height': '2.25rem',
  '--rdp-day-width': '2.25rem',
  '--rdp-day_button-height': '2rem',
  '--rdp-day_button-width': '2rem',
  '--rdp-day_button-border-radius': 'var(--radius)',
  '--rdp-nav_button-height': '1.75rem',
  '--rdp-nav_button-width': '1.75rem',
  '--rdp-nav-height': '2rem',
} as CSSProperties;

/** The chevrons the navigation buttons draw, so the calendar's arrows match every other arrow here. */
function CalendarChevron({ orientation, className }: ChevronProps) {
  const Arrow = orientation === 'left' ? ChevronLeft : ChevronRight;
  return <Arrow className={cn('h-4 w-4', className)} aria-hidden />;
}

/**
 * The caption's month and year pickers, drawn with the app's own `Select`.
 *
 * react-day-picker hands this slot a `<select>`-shaped contract — a flat option list and a change event
 * carrying the new value — so the adapter's whole job is to hand `onChange` an event shaped like the one
 * a native select would have fired.
 */
function CalendarDropdown({ options = [], value, onChange, 'aria-label': ariaLabel }: DropdownProps) {
  return (
    <Select
      value={String(value)}
      onValueChange={(next) =>
        onChange?.({ target: { value: next } } as unknown as ChangeEvent<HTMLSelectElement>)}
    >
      <SelectTrigger aria-label={ariaLabel} className="h-8 w-auto gap-1 border-none px-2 font-medium shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options.map((option) => (
          <SelectItem key={option.value} value={String(option.value)} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** How far either side of this year the caption's year list reaches. */
const YEAR_REACH = 10;

/** The years the caption offers, read off the clock rather than fixed, so the range rolls with it. */
function captionRange() {
  const year = new Date().getFullYear();
  return { startMonth: new Date(year - YEAR_REACH, 0), endMonth: new Date(year + YEAR_REACH, 11) };
}

/** Split a `YYYY-MM-DDTHH:mm` value into its halves; either can be missing. */
function splitLocal(value: string): { day: string; time: string } {
  const [day = '', time = ''] = value.split('T');
  return { day, time: time.slice(0, 5) };
}

/** The calendar speaks `Date`; the field speaks the string. Parsed as local noon so no zone can shift the day. */
function dayToDate(day: string): Date | undefined {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return undefined;
  return new Date(year, month - 1, date, 12);
}

/** Two digits, the way the value's every part is written. */
const pad = (value: number) => String(value).padStart(2, '0');

function dateToDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** How a chosen day reads on the button, in the reader's own locale. */
function formatDay(day: string): string {
  const date = dayToDate(day);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** An event scheduled for a day nobody named an hour for opens at midnight. */
const DEFAULT_TIME = '00:00';

function parseTime(time: string): { hour: number; minute: number } {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return { hour, minute };
}

/** Whether this reader's locale writes hours on a 12-hour clock, and so needs a meridiem beside them. */
function usesTwelveHourClock(): boolean {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;
}

/** Typing keeps every minute; the column offers the ones anyone schedules by. */
const MINUTE_STEPS = Array.from({ length: 12 }, (_, index) => index * 5);
const HOURS_24 = Array.from({ length: 24 }, (_, index) => index);
/** Noon and midnight are both written 12 on this clock, and both open the half they belong to. */
const HOURS_12 = Array.from({ length: 12 }, (_, index) => (index === 0 ? 12 : index));

/** Centers a cell inside its column the moment it becomes the selected one, so the pick is never off-screen. */
const centerInColumn = (element: HTMLButtonElement | null) => {
  const column = element?.closest('[data-time-column]');
  if (element && column) {
    column.scrollTop = element.offsetTop - column.clientHeight / 2 + element.clientHeight / 2;
  }
};

/** A borderless scrolling value column; the scrollbar stays hidden so the picker reads as one surface. */
function TimeColumn({ children }: { children: ReactNode }) {
  return (
    <div
      data-time-column=""
      // w-12 + gap-1: 40px-wide cells with a touch more air between rows, so the 32px-tall numbers read as
      // squares rather than slabs.
      className="flex h-56 w-12 flex-col gap-1 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </div>
  );
}

/** One value in an hour or minute column. */
function TimeCell({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      // Button defers to the element default, which inside a <form> is submit — and this field is meant
      // to drop in wherever a native input was, forms included.
      type="button"
      variant={selected ? 'default' : 'ghost'}
      size="sm"
      // border-transparent: the ghost variant is outlined, and a bordered grid of cells reads as noise next
      // to the calendar's borderless day buttons.
      // shrink-0: the column is both flex container and scroll container; without it the cells compress to
      // fit instead of overflowing into scroll.
      className={cn(
        'h-8 w-full shrink-0 justify-center px-0 text-label tabular-nums',
        !selected && 'border-transparent',
      )}
      // The fill is the only thing saying which value is the chosen one; a reader who cannot see it needs
      // to be told the same thing.
      aria-pressed={selected}
      onClick={onClick}
      ref={selected ? centerInColumn : undefined}
    >
      {label}
    </Button>
  );
}

/**
 * Hour and minute columns, with a meridiem rail where the locale wants one.
 *
 * Every click writes through and the popover stays open, so an hour, a minute and a half of the day are
 * three separate corrections rather than one transaction to confirm.
 */
function TimeColumns({ time, hour12, onCommit }: {
  time: string; hour12: boolean; onCommit: (next: string) => void;
}) {
  const { hour, minute } = parseTime(time || DEFAULT_TIME);
  const isPM = hour >= 12;
  const shownHour = hour12 ? (hour % 12 === 0 ? 12 : hour % 12) : hour;

  const pickHour = (shown: number) =>
    onCommit(`${pad(hour12 ? (shown % 12) + (isPM ? 12 : 0) : shown)}:${pad(minute)}`);
  const pickMinute = (next: number) => onCommit(`${pad(hour)}:${pad(next)}`);
  const pickMeridiem = (pm: boolean) => onCommit(`${pad((hour % 12) + (pm ? 12 : 0))}:${pad(minute)}`);

  return (
    <div className="flex gap-1">
      <TimeColumn>
        {(hour12 ? HOURS_12 : HOURS_24).map((candidate) => (
          <TimeCell
            key={candidate}
            selected={shownHour === candidate}
            label={hour12 ? String(candidate) : pad(candidate)}
            onClick={() => pickHour(candidate)}
          />
        ))}
      </TimeColumn>
      <TimeColumn>
        {MINUTE_STEPS.map((candidate) => (
          <TimeCell
            key={candidate}
            selected={minute === candidate}
            label={pad(candidate)}
            onClick={() => pickMinute(candidate)}
          />
        ))}
      </TimeColumn>
      {hour12 && (
        <ToggleGroup
          type="single"
          orientation="vertical"
          // h-auto: the shared root pins the horizontal control's h-10, which crushes a stacked pair.
          // bg-transparent/p-0: no pill chrome — the pair sits on the popover surface like the cells do.
          className="h-auto flex-col items-stretch gap-1 bg-transparent p-0"
          value={isPM ? 'pm' : 'am'}
          onValueChange={(next) => next && pickMeridiem(next === 'pm')}
        >
          <ToggleGroupItem value="am" className="h-8 w-12">AM</ToggleGroupItem>
          <ToggleGroupItem value="pm" className="h-8 w-12">PM</ToggleGroupItem>
        </ToggleGroup>
      )}
    </div>
  );
}

interface DateTimeFieldProps {
  /** The moment, as `YYYY-MM-DDTHH:mm` in the reader's own zone — the value a native field carried.
   *  Under `dateOnly` it is a bare `YYYY-MM-DD` instead, the value a native `type="date"` carried. */
  value: string;
  onChange: (next: string) => void;
  /** Names the pair for a screen reader; the two controls take it as "<label> date" and "<label> time". */
  label: string;
  /** Ask for a day rather than a moment: no time control, and the field stops stretching to fill its row.
   *  For something dated to the day — a changelog entry — where an hour would be a control that changes
   *  nothing and a clock beside it a question nobody asked. */
  dateOnly?: boolean;
  /** Shown but not editable — a window that has already opened, say. */
  readOnly?: boolean;
  /** Ties a caller's `<Label htmlFor>` to the date button. */
  id?: string;
  className?: string;
}

/**
 * A moment, picked in the app's own chrome.
 *
 * The native `datetime-local` input opens the browser's calendar, which follows the operating system's
 * theme rather than this app's — foreign next to everything around it, and unreachable to style. This
 * reads and writes the same `YYYY-MM-DDTHH:mm` string that input does, so it drops in wherever one was.
 *
 * Date and time are two controls because they are two decisions: the calendar answers which day, and the
 * time field answers when on it. The hour stays typeable, with the columns as the second way in rather
 * than the only one — a popover is slower than knowing the number you want.
 */
export function DateTimeField({
  value, onChange, label, readOnly = false, dateOnly = false, id, className,
}: DateTimeFieldProps) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const { startMonth, endMonth } = useMemo(captionRange, []);
  const hour12 = useMemo(usesTwelveHourClock, []);

  const { day, time } = splitLocal(value);
  const selected = dayToDate(day);

  // A day-only field has no second half to wait for and writes the bare day.
  const emitDay = (nextDay: string) =>
    onChange(dateOnly ? nextDay : `${nextDay}T${time || DEFAULT_TIME}`);

  // An hour alone is not a moment either, but in a visual picker a click that writes nothing reads as a
  // broken control — so the first one lands on today and the calendar corrects it from there.
  const emitTime = (nextTime: string) =>
    onChange(`${day || dateToDay(new Date())}T${nextTime || DEFAULT_TIME}`);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Read-only is applied to what is shown rather than to what opens it, so a field that turns
          read-only while a popover is up closes it rather than leaving a live control behind. */}
      <Popover open={dateOpen && !readOnly} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={buttonId}
            aria-label={`${label} date`}
            disabled={readOnly}
            className={cn(
              'flex h-10 min-w-[9rem] items-center gap-2 rounded-md border border-input bg-background px-3 text-label',
              // Only the pair shares a row, so only the pair has a stretch to divide.
              !dateOnly && 'flex-1',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !day && 'text-muted-foreground',
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {day ? formatDay(day) : 'Pick a date'}
          </button>
        </PopoverTrigger>
        {/* portal={false}: inside a modal Dialog, the scroll lock swallows wheel events on body-portaled content. */}
        <PopoverContent portal={false} className="w-auto p-3" align="start">
          <DayPicker
            mode="single"
            // rdp's cells use `font: inherit`, and the popover inherits body size; text-label matches
            // the caption dropdowns and the clock columns.
            className="text-label"
            selected={selected}
            defaultMonth={selected}
            showOutsideDays
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            style={CALENDAR_THEME}
            components={{ Chevron: CalendarChevron, Dropdown: CalendarDropdown }}
            onSelect={(next) => {
              if (!next) return;
              emitDay(dateToDay(next));
              setDateOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {!dateOnly && (
        <div className="relative">
          <Input
            type="time"
            aria-label={`${label} time`}
            // The native indicator opens the browser's own picker, which is the chrome this replaces.
            className="w-[7.5rem] pr-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            value={time || DEFAULT_TIME}
            readOnly={readOnly}
            onChange={(event) => emitTime(event.target.value)}
          />
          <div className="absolute inset-y-0 right-1 flex items-center">
            <Popover open={timeOpen && !readOnly} onOpenChange={setTimeOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  aria-label={`${label} time picker`}
                  disabled={readOnly}
                >
                  <Clock className="h-4 w-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent portal={false} className="w-auto p-2" align="end">
                <TimeColumns time={time} hour12={hour12} onCommit={emitTime} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}
