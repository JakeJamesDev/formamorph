import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTimeField } from './date-time-field';

/**
 * The themed replacement for a native `datetime-local` input.
 *
 * Asserted the way an admin uses it — press the date, pick a day, set an hour — rather than through the
 * calendar's internals, so a future react-day-picker upgrade is a change these keep watching over.
 *
 * The hour is set with a change event rather than keystrokes: a time input is a segmented control that
 * emits one complete `HH:mm`, and jsdom's stand-in rejects the partial values typing walks through.
 */

/** The field is controlled, so the harness holds the value the way its real caller does. */
function Harness(
  { initial, onChange, readOnly, dateOnly }: {
    initial: string; onChange: (next: string) => void; readOnly?: boolean; dateOnly?: boolean;
  },
) {
  const [value, setValue] = useState(initial);
  return (
    <DateTimeField
      value={value}
      onChange={(next) => { setValue(next); onChange(next); }}
      label="Starts"
      readOnly={readOnly}
      dateOnly={dateOnly}
    />
  );
}

const view = (value: string, onChange = vi.fn(), extra: { readOnly?: boolean; dateOnly?: boolean } = {}) => {
  render(<Harness initial={value} onChange={onChange} readOnly={extra.readOnly} dateOnly={extra.dateOnly} />);
  return onChange;
};

const dateButton = () => screen.getByRole('button', { name: 'Starts date' });
const timeField = () => screen.getByLabelText('Starts time') as HTMLInputElement;
const clockButton = () => screen.getByRole('button', { name: 'Starts time picker' });
/** An hour or minute in the picker's columns; a meridiem is a radio rather than a cell. */
const cell = (label: string) => screen.getByRole('button', { name: label });
const meridiem = (label: 'AM' | 'PM') => screen.getByRole('radio', { name: label });

const pad = (n: number) => String(n).padStart(2, '0');
/** The day the field seeds when it is handed an hour and no date to hang it on. */
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Opens the time columns and hands back the value the field started on. */
const openClock = async (value: string) => {
  const onChange = view(value);
  await userEvent.click(clockButton());
  return onChange;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('what an empty field offers', () => {
  it('says there is a date to pick rather than showing a blank control', () => {
    view('');

    expect(dateButton().textContent).toContain('Pick a date');
  });

  it('lands an hour set before any day on today, rather than swallowing it', () => {
    // An hour alone is not a moment, but a control that visibly does nothing reads as broken. Today is the
    // day the calendar is already showing, so the guess is the one a correction is cheapest from.
    const onChange = view('');

    fireEvent.change(timeField(), { target: { value: '09:30' } });

    expect(onChange).toHaveBeenLastCalledWith(`${today()}T09:30`);
  });
});

describe('what a filled field shows', () => {
  it('reads the day back in words, not as the stored string', () => {
    view('2026-08-21T14:30');

    expect(dateButton().textContent).toMatch(/Aug/);
    expect(dateButton().textContent).toMatch(/21/);
    expect(dateButton().textContent).toMatch(/2026/);
  });

  it('shows the hour it was given', () => {
    view('2026-08-21T14:30');

    expect(timeField().value).toBe('14:30');
  });

  it('reads a value carrying seconds without losing the hour', () => {
    // The server answers in full ISO; whatever survives the caller's conversion must still display.
    view('2026-08-21T14:30:00');

    expect(timeField().value).toBe('14:30');
  });
});

describe('picking a day', () => {
  it('opens a calendar in the app rather than the browser', async () => {
    view('2026-08-21T14:30');

    await userEvent.click(dateButton());

    expect(await screen.findByRole('grid')).toBeTruthy();
    // The native control is what this exists to replace: nothing here may still be one.
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull();
  });

  it('keeps the hour that was already set', async () => {
    const onChange = view('2026-08-21T14:30');

    await userEvent.click(dateButton());
    await userEvent.click(await screen.findByRole('button', { name: /August 25th, 2026/ }));

    expect(onChange).toHaveBeenCalledWith('2026-08-25T14:30');
  });

  it('opens at midnight when no hour was ever set', async () => {
    const onChange = view('');

    await userEvent.click(dateButton());
    await userEvent.click(await screen.findByRole('button', { name: /15th/ }));

    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/T00:00$/));
  });

  it('closes once the day is picked, so the hour is reachable straight after', async () => {
    view('2026-08-21T14:30');

    await userEvent.click(dateButton());
    await userEvent.click(await screen.findByRole('button', { name: /August 25th, 2026/ }));

    expect(screen.queryByRole('grid')).toBeNull();
  });
});

describe('changing the hour', () => {
  it('keeps the day it was set on', () => {
    const onChange = view('2026-08-21T14:30');

    fireEvent.change(timeField(), { target: { value: '08:15' } });

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T08:15');
  });
});

describe('a window that has already opened', () => {
  it('shows its moment but refuses to move it', async () => {
    const onChange = view('2026-08-21T14:30', vi.fn(), { readOnly: true });

    expect(dateButton().textContent).toMatch(/Aug/);
    await userEvent.click(dateButton());

    expect(screen.queryByRole('grid')).toBeNull();
    expect(timeField()).toHaveAttribute('readonly');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes the hour columns off too, not only the calendar', async () => {
    const onChange = view('2026-08-21T14:30', vi.fn(), { readOnly: true });

    expect(clockButton()).toBeDisabled();
    await userEvent.click(clockButton());

    expect(screen.queryByRole('radio', { name: 'AM' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('takes a picker down that was already up when the window opened', async () => {
    // The two pickers outlive the moment `readOnly` flips, so a guard on what opens them would leave a
    // live control sitting over a field that is no longer editable.
    const field = (readOnly: boolean) =>
      <DateTimeField value="2026-08-21T14:30" onChange={vi.fn()} label="Starts" readOnly={readOnly} />;
    const { rerender } = render(field(false));
    await userEvent.click(clockButton());
    expect(screen.getByRole('radio', { name: 'AM' })).toBeInTheDocument();

    rerender(field(true));

    expect(screen.queryByRole('radio', { name: 'AM' })).toBeNull();
  });

  it('takes the calendar down for the same reason', async () => {
    const field = (readOnly: boolean) =>
      <DateTimeField value="2026-08-21T14:30" onChange={vi.fn()} label="Starts" readOnly={readOnly} />;
    const { rerender } = render(field(false));
    await userEvent.click(dateButton());
    expect(await screen.findByRole('grid')).toBeInTheDocument();

    rerender(field(true));

    expect(screen.queryByRole('grid')).toBeNull();
  });
});

describe('a field asked for a day rather than a moment', () => {
  it('offers no clock, because an hour on it would change nothing', () => {
    view('2026-08-21', vi.fn(), { dateOnly: true });

    expect(screen.queryByLabelText('Starts time')).toBeNull();
    expect(dateButton().textContent).toMatch(/Aug/);
  });

  it('reads and writes the bare day', async () => {
    const onChange = view('2026-08-21', vi.fn(), { dateOnly: true });

    await userEvent.click(dateButton());
    await userEvent.click(await screen.findByRole('button', { name: /August 25th, 2026/ }));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-25');
  });

  it('stops stretching across the row it no longer shares', () => {
    // The stretch exists to divide a row between two controls; alone, the button would grow to whatever
    // width its container happens to have.
    view('2026-08-21', vi.fn(), { dateOnly: true });

    expect(dateButton().className.split(' ')).not.toContain('flex-1');
  });

  it('still stretches when it has a time field to share with', () => {
    view('2026-08-21T14:30');

    expect(dateButton().className.split(' ')).toContain('flex-1');
  });
});

/**
 * The columns behind the clock button.
 *
 * jsdom resolves to en-US, so these run on a 12-hour clock and read hours the way that reader would. The
 * 24-hour block below simulates the other locale rather than assuming this one covers both.
 */
describe('picking an hour from the columns', () => {
  it('marks the hour, the minute and the half of the day the value is already on', async () => {
    await openClock('2026-08-21T14:30');

    expect(cell('2')).toHaveAttribute('aria-pressed', 'true');
    expect(cell('30')).toHaveAttribute('aria-pressed', 'true');
    expect(meridiem('PM')).toBeChecked();
  });

  it('writes an hour through the moment it is clicked', async () => {
    const onChange = await openClock('2026-08-21T14:30');

    await userEvent.click(cell('9'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T21:30');
  });

  it('writes a minute through the moment it is clicked', async () => {
    const onChange = await openClock('2026-08-21T14:30');

    await userEvent.click(cell('45'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T14:45');
  });

  it('writes the half of the day through the moment it is clicked', async () => {
    const onChange = await openClock('2026-08-21T14:30');

    await userEvent.click(meridiem('AM'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T02:30');
  });

  it('stays open across all three, so an hour and a minute are one visit', async () => {
    const onChange = await openClock('2026-08-21T14:30');

    await userEvent.click(cell('9'));
    await userEvent.click(cell('45'));
    await userEvent.click(meridiem('AM'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T09:45');
    expect(screen.getByRole('radio', { name: 'AM' })).toBeInTheDocument();
  });

  it('submits no form it happens to be standing in', async () => {
    // A button with no type is a submit button. This field replaces a native input, and native inputs
    // live in forms, so an hour click must not be the thing that posts one.
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DateTimeField value="2026-08-21T14:30" onChange={vi.fn()} label="Starts" />
      </form>,
    );

    await userEvent.click(clockButton());
    await userEvent.click(cell('9'));
    await userEvent.click(cell('45'));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('offers minutes in fives, and leaves a typed one alone', async () => {
    const onChange = view('2026-08-21T14:37');

    await userEvent.click(clockButton());

    expect(screen.queryByRole('button', { name: '37' })).toBeNull();
    expect(timeField().value).toBe('14:37');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the two hours written 12', () => {
  it('reads midnight as 12 in the morning', async () => {
    await openClock('2026-08-21T00:30');

    expect(cell('12')).toHaveAttribute('aria-pressed', 'true');
    expect(meridiem('AM')).toBeChecked();
  });

  it('reads noon as 12 in the afternoon', async () => {
    await openClock('2026-08-21T12:30');

    expect(cell('12')).toHaveAttribute('aria-pressed', 'true');
    expect(meridiem('PM')).toBeChecked();
  });

  it('turns midnight into noon, not into hour 12 of the morning', async () => {
    const onChange = await openClock('2026-08-21T00:30');

    await userEvent.click(meridiem('PM'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T12:30');
  });

  it('turns noon back into midnight, not into hour 24', async () => {
    const onChange = await openClock('2026-08-21T12:30');

    await userEvent.click(meridiem('AM'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T00:30');
  });

  it('keeps the afternoon when 12 is clicked with PM lit', async () => {
    const onChange = await openClock('2026-08-21T15:30');

    await userEvent.click(cell('12'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T12:30');
  });

  it('keeps the morning when 12 is clicked with AM lit', async () => {
    const onChange = await openClock('2026-08-21T03:30');

    await userEvent.click(cell('12'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T00:30');
  });
});

describe('a reader whose locale writes hours to 24', () => {
  // The field asks the locale one question; this answers it the other way. Stubbing `resolvedOptions`
  // rather than the whole constructor leaves every other formatter — month names, day labels — intact.
  const useTwentyFourHourClock = () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(
      function resolvedOptions(this: Intl.DateTimeFormat) {
        return { ...real.call(this), hour12: false };
      },
    );
  };

  it('numbers the hours to 23 and asks for no half of the day', async () => {
    useTwentyFourHourClock();

    await openClock('2026-08-21T14:30');

    expect(cell('23')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'AM' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'PM' })).toBeNull();
  });

  it('marks the hour by the number it is stored as', async () => {
    useTwentyFourHourClock();

    await openClock('2026-08-21T14:30');

    expect(cell('14')).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes the hour it shows, with no meridiem to fold in', async () => {
    useTwentyFourHourClock();
    const onChange = await openClock('2026-08-21T14:30');

    await userEvent.click(cell('13'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T13:30');
  });
});

describe('an hour picked before any day', () => {
  it('lands on today rather than vanishing', async () => {
    const onChange = await openClock('');

    await userEvent.click(cell('9'));

    expect(onChange).toHaveBeenLastCalledWith(`${today()}T09:00`);
  });

  it('lands the half of the day on today too', async () => {
    const onChange = await openClock('');

    await userEvent.click(meridiem('PM'));

    expect(onChange).toHaveBeenLastCalledWith(`${today()}T12:00`);
  });

  it('leaves the day the calendar already chose alone', async () => {
    const onChange = await openClock('2026-08-21T14:30');

    await userEvent.click(cell('9'));

    expect(onChange).toHaveBeenLastCalledWith('2026-08-21T21:30');
  });
});

describe('reaching a distant month', () => {
  const monthPicker = () => screen.getByRole('combobox', { name: 'Choose the Month' });
  const yearPicker = () => screen.getByRole('combobox', { name: 'Choose the Year' });
  const thisYear = new Date().getFullYear();

  it('names the month and the year rather than making them chevron work', async () => {
    view('2026-08-21T14:30');

    await userEvent.click(dateButton());

    expect(monthPicker()).toBeInTheDocument();
    expect(yearPicker()).toBeInTheDocument();
  });

  it('reaches ten years either side of this one, and no further', async () => {
    view('2026-08-21T14:30');
    await userEvent.click(dateButton());

    await userEvent.click(yearPicker());

    expect(screen.getByRole('option', { name: String(thisYear - 10) })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: String(thisYear + 10) })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: String(thisYear - 11) })).toBeNull();
    expect(screen.queryByRole('option', { name: String(thisYear + 11) })).toBeNull();
  });

  it('moves the calendar to the year picked', async () => {
    view('2026-08-21T14:30');
    await userEvent.click(dateButton());

    await userEvent.click(yearPicker());
    await userEvent.click(screen.getByRole('option', { name: String(thisYear + 4) }));

    expect(await screen.findByRole('button', { name: new RegExp(`August 25th, ${thisYear + 4}`) }))
      .toBeInTheDocument();
  });

  it('moves the calendar to the month picked', async () => {
    view('2026-08-21T14:30');
    await userEvent.click(dateButton());

    await userEvent.click(monthPicker());
    await userEvent.click(screen.getByRole('option', { name: 'November' }));

    expect(await screen.findByRole('button', { name: /November 25th, 2026/ })).toBeInTheDocument();
  });

  it('still writes the day that was clicked after the caption moved', async () => {
    const onChange = view('2026-08-21T14:30');
    await userEvent.click(dateButton());

    await userEvent.click(monthPicker());
    await userEvent.click(screen.getByRole('option', { name: 'November' }));
    await userEvent.click(await screen.findByRole('button', { name: /November 25th, 2026/ }));

    expect(onChange).toHaveBeenLastCalledWith('2026-11-25T14:30');
  });
});
