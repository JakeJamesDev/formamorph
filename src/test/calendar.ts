import { fireEvent, waitFor, within } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * Pick a day off a `DateTimeField` calendar the way a person does: open it, page to the month, press the day.
 *
 * `day` names the cell's whole label, month included: outside days put the next month's first days in the
 * last row. The calendar opens on whatever month it showed last, so paging runs toward `month` either way.
 */
export async function pickCalendarDay(opener: HTMLElement, day: RegExp, month: Date) {
  fireEvent.click(opener);
  const popover = document.getElementById(opener.getAttribute('aria-controls') ?? '');
  if (!popover) throw new Error(`${opener.getAttribute('aria-label')} opened no popover`);
  // Scoped to this popover: the last field's calendar may still be closing beside it.
  const calendar = within(popover);
  await calendar.findByRole('grid'); // the calendar loads on open

  const cell = () => calendar.queryByRole('button', { name: day });
  const shown = () => new Date(`${calendar.getByRole('grid').getAttribute('aria-label')} 1`).getTime();
  const target = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  for (let paged = 0; paged < 36 && !cell(); paged++) {
    fireEvent.click(calendar.getByRole('button', { name: target > shown() ? /Next Month/i : /Previous Month/i }));
  }

  fireEvent.click(cell()!);
  // A pick closes the calendar and hands focus back to its button before anyone reaches the next field.
  await waitFor(() => expect(document.activeElement).toBe(opener));
}

/** Pick a `YYYY-MM-DD` day, named as its cell reads: "April 1st, 2026". */
export async function pickCalendarDate(opener: HTMLElement, isoDay: string) {
  const [year, month, date] = isoDay.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const monthName = first.toLocaleDateString('en-US', { month: 'long' });
  const suffix = ['th', 'st', 'nd', 'rd'][(date % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][date % 100] ?? 'th';
  await pickCalendarDay(opener, new RegExp(`${monthName} ${date}${suffix}, ${year}`), first);
}
