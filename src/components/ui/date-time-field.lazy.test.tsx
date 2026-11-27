import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

/**
 * The calendar loads all of date-fns, so it waits until someone reaches for it: every form that holds a
 * date field would otherwise pay for it on open.
 */

const calendarImported = vi.fn();

const mountField = async () => {
  const { DateTimeField } = await import('./date-time-field');
  render(<DateTimeField value="2026-08-25T09:00" onChange={() => {}} label="Starts" />);
  return screen.getByRole('button', { name: 'Starts date' });
};

beforeEach(() => {
  vi.resetModules();
  calendarImported.mockClear();
  // Registered per test: a module mocked once stays cached across `resetModules`.
  vi.doMock('./date-calendar', async (importOriginal) => {
    calendarImported();
    return importOriginal();
  });
});

describe('the date field loads its calendar on approach', () => {
  it('leaves the calendar unloaded until a pointer reaches the date button', async () => {
    const button = await mountField();
    expect(calendarImported).not.toHaveBeenCalled();

    fireEvent.pointerEnter(button);
    await vi.waitFor(() => expect(calendarImported).toHaveBeenCalledTimes(1));
  });

  it('loads it when the date button takes focus, for a keyboard reader', async () => {
    const button = await mountField();
    expect(calendarImported).not.toHaveBeenCalled();

    act(() => button.focus());
    await vi.waitFor(() => expect(calendarImported).toHaveBeenCalledTimes(1));
  });

  it('opens straight onto the calendar once a hover has loaded it, with no placeholder between', async () => {
    const button = await mountField();
    fireEvent.pointerEnter(button);
    await vi.waitFor(() => expect(calendarImported).toHaveBeenCalledTimes(1));
    await act(() => new Promise((settle) => setTimeout(settle, 0)));

    fireEvent.click(button);

    expect(document.querySelector('[data-calendar-loading]')).toBeNull();
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  describe('when the calendar chunk fails to load', () => {
    beforeEach(() => {
      vi.doMock('./date-calendar', () => { throw new TypeError('Failed to fetch dynamically imported module'); });
    });

    it('keeps the hover and focus fetches quiet, so no unhandled rejection reaches the player', async () => {
      const button = await mountField();
      fireEvent.pointerEnter(button);
      act(() => button.focus());
      // Lets both rejections settle inside this test.
      await act(() => new Promise((settle) => setTimeout(settle, 50)));
    });

    it('says so inside the popover', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const button = await mountField();
      fireEvent.click(button);

      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the calendar.");
      warn.mockRestore();
      error.mockRestore();
    });
  });

  it('still opens onto the calendar when nothing reached the button first', async () => {
    const button = await mountField();
    fireEvent.click(button);

    expect(await screen.findByRole('grid')).toBeInTheDocument();
  });
});
