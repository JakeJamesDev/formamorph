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
  { initial, onChange, readOnly }: { initial: string; onChange: (next: string) => void; readOnly?: boolean },
) {
  const [value, setValue] = useState(initial);
  return (
    <DateTimeField
      value={value}
      onChange={(next) => { setValue(next); onChange(next); }}
      label="Starts"
      readOnly={readOnly}
    />
  );
}

const view = (value: string, onChange = vi.fn(), extra: { readOnly?: boolean } = {}) => {
  render(<Harness initial={value} onChange={onChange} readOnly={extra.readOnly} />);
  return onChange;
};

const dateButton = () => screen.getByRole('button', { name: 'Starts date' });
const timeField = () => screen.getByLabelText('Starts time') as HTMLInputElement;

afterEach(cleanup);

describe('what an empty field offers', () => {
  it('says there is a date to pick rather than showing a blank control', () => {
    view('');

    expect(dateButton().textContent).toContain('Pick a date');
  });

  it('writes nothing until a day is chosen — an hour alone is not a moment', () => {
    const onChange = view('');

    fireEvent.change(timeField(), { target: { value: '09:30' } });

    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('09:30'));
    expect(onChange.mock.calls.every(([next]) => next === '')).toBe(true);
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
});
