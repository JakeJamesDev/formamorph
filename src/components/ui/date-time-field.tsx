import { useId, useState, type CSSProperties } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type ChevronProps } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

interface DateTimeFieldProps {
  /** The moment, as `YYYY-MM-DDTHH:mm` in the reader's own zone — the value a native field carried. */
  value: string;
  onChange: (next: string) => void;
  /** Names the pair for a screen reader; the two controls take it as "<label> date" and "<label> time". */
  label: string;
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
 * time field answers when on it, without a popover in the way of typing an hour.
 */
export function DateTimeField({ value, onChange, label, readOnly = false, id, className }: DateTimeFieldProps) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const [open, setOpen] = useState(false);

  const { day, time } = splitLocal(value);
  const selected = dayToDate(day);

  // Either half alone is not a moment, so the value is only written once both are known. The time keeps
  // its default until a day is picked, which is what lets the calendar be opened first.
  const emit = (nextDay: string, nextTime: string) => onChange(nextDay ? `${nextDay}T${nextTime}` : '');

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Popover open={open} onOpenChange={(next) => setOpen(next && !readOnly)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={buttonId}
            aria-label={`${label} date`}
            disabled={readOnly}
            className={cn(
              'flex h-10 flex-1 min-w-[9rem] items-center gap-2 rounded-md border border-input bg-background px-3 text-label',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !day && 'text-muted-foreground',
            )}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            {day ? formatDay(day) : 'Pick a date'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            showOutsideDays
            style={CALENDAR_THEME}
            components={{ Chevron: CalendarChevron }}
            onSelect={(next) => {
              if (!next) return;
              emit(dateToDay(next), time || DEFAULT_TIME);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      <Input
        type="time"
        aria-label={`${label} time`}
        className="w-[7.5rem]"
        value={time || DEFAULT_TIME}
        readOnly={readOnly}
        onChange={(event) => emit(day, event.target.value || DEFAULT_TIME)}
      />
    </div>
  );
}
