import type { ChangeEvent, CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type ChevronProps, type DropdownProps } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export interface DateCalendarProps {
  selected: Date | undefined;
  startMonth: Date;
  endMonth: Date;
  onSelect: (day: Date) => void;
}

/** One day picked off a month grid, with dropdown captions over the given span. */
export default function DateCalendar({ selected, startMonth, endMonth, onSelect }: DateCalendarProps) {
  return (
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
        if (next) onSelect(next);
      }}
    />
  );
}
