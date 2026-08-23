import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ChangelogEntryDialog } from './ChangelogEntryDialog';
import { todayForDateInput } from '@/lib/listingChangelog';

// jsdom can't drive a real Lexical selection; the editor is stubbed to a textarea so it can be filled.
vi.mock('@/components/prompt/PromptField', () => ({
  default: ({ value, onChange, ariaLabel, placeholder }: {
    value: string; onChange: (v: string) => void; ariaLabel?: string; placeholder?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

/**
 * The one popup that writes a Changelog Entry.
 *
 * Every surface uses it — adding, backfilling, rewriting, and the note attached to a publish — so what it
 * hands back has to be the same three fields whichever door was used, and it has to refuse the same
 * things the server would before the author waits on a round trip to hear it.
 */

const titleBox = () => screen.getByLabelText('Title') as HTMLInputElement;
const bodyBox = () => screen.getByLabelText('What changed') as HTMLTextAreaElement;
const submit = (name: RegExp = /add entry|save entry/i) => screen.getByRole('button', { name });

/** The day the themed calendar's button is showing, as the reader sees it. */
const dateButton = () => screen.getByRole('button', { name: 'Date date' });
const shownDay = () => dateButton().textContent;

/** What the button reads for a given day, so a test names the day rather than a locale's rendering. */
const asShown = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date)
    .toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Pick a day out of the app's own calendar: open it, page to the month, press the day. Adapted from the
 * event form's helper, which drives the same field.
 */
const pickDate = (day: string) => {
  fireEvent.click(dateButton());

  const [year, month, date] = day.split('-').map(Number);
  const target = new Date(year, month - 1, 1).getTime();
  // Named with its month, not just its ordinal: `showOutsideDays` puts the next month's first days in the
  // last row, so "1st, 2026" alone matches two cells — and clicking the wrong one picks the wrong month.
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  const suffix = ['th', 'st', 'nd', 'rd'][(date % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][date % 100] ?? 'th';
  const label = `${monthName} ${date}${suffix}, ${year}`;

  const cell = () => screen.queryByRole('button', { name: new RegExp(label) });
  const shown = () => new Date(`${screen.getByRole('grid').getAttribute('aria-label')} 1`).getTime();

  for (let paged = 0; paged < 36 && !cell(); paged++) {
    fireEvent.click(screen.getByRole('button', { name: target > shown() ? /Next Month/i : /Previous Month/i }));
  }

  fireEvent.click(cell()!);
};

const show = (props: Record<string, unknown> = {}) =>
  render(
    <ChangelogEntryDialog
      open
      onOpenChange={() => {}}
      onSubmit={() => {}}
      {...props}
    />
  );

const fill = (over: { title?: string; body?: string; date?: string } = {}) => {
  if (over.title !== undefined) fireEvent.change(titleBox(), { target: { value: over.title } });
  if (over.body !== undefined) fireEvent.change(bodyBox(), { target: { value: over.body } });
  if (over.date !== undefined) pickDate(over.date);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('opening the popup', () => {
  it('starts blank and dated today when there is no entry to edit', () => {
    show();

    expect(titleBox().value).toBe('');
    expect(bodyBox().value).toBe('');
    expect(shownDay()).toBe(asShown(todayForDateInput()));
  });

  it('fills in the entry it was handed, its own date included', () => {
    // Backfilled history is the reason the date is a field at all; an edit that reset it to today would
    // rewrite the one thing the author set deliberately.
    show({ entry: { title: 'New for v2', body: 'The ferry runs again.', date: '2026-01-09' } });

    expect(titleBox().value).toBe('New for v2');
    expect(bodyBox().value).toBe('The ferry runs again.');
    expect(shownDay()).toBe(asShown('2026-01-09'));
  });

  it('names itself for what it is doing', () => {
    show();
    expect(screen.getByText('Add Changelog Entry')).toBeInTheDocument();

    cleanup();
    show({ entry: { title: 'x', body: 'y', date: '2026-01-09' } });
    expect(screen.getByText('Edit Changelog Entry')).toBeInTheDocument();
  });

  it('lets the caller name the button, so a publish can say what it really does', () => {
    show({ submitLabel: 'Attach to Update' });

    expect(screen.getByRole('button', { name: 'Attach to Update' })).toBeInTheDocument();
  });
});

describe('handing the draft back', () => {
  it('submits the three fields, trimmed', () => {
    const onSubmit = vi.fn();
    show({ onSubmit });

    fill({ title: '  Update 1  ', body: '  The drowned quarter is walkable.  ', date: '2026-08-01' });
    fireEvent.click(submit());

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Update 1',
      body: 'The drowned quarter is walkable.',
      date: '2026-08-01',
    });
  });

  it('closes once the caller has taken it', async () => {
    const onOpenChange = vi.fn();
    show({ onOpenChange, onSubmit: () => {} });

    fill({ title: 'Update 1', body: 'Something changed.' });
    fireEvent.click(submit());

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('stays open with the refusal beside the field when the caller throws', async () => {
    // What the author wrote is still on screen, and a message they can act on belongs next to it rather
    // than in a toast over a popup that has closed.
    const onOpenChange = vi.fn();
    show({
      onOpenChange,
      onSubmit: () => { throw new Error('A changelog holds at most 100 entries.'); },
    });

    fill({ title: 'Update 1', body: 'Something changed.' });
    fireEvent.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent('A changelog holds at most 100 entries.');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(titleBox().value).toBe('Update 1');
  });

  it('sends nothing at all when the entry has no title', () => {
    const onSubmit = vi.fn();
    show({ onSubmit });

    fill({ title: '   ', body: 'Something changed.' });
    fireEvent.click(submit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('sends nothing when the entry says nothing', () => {
    const onSubmit = vi.fn();
    show({ onSubmit });

    fill({ title: 'Update 1', body: '  ' });
    fireEvent.click(submit());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends nothing while no day has been picked', () => {
    // Reachable through an entry whose date was never set — `??` passes an empty string through, so the
    // calendar opens on "Pick a date" and the entry is not a dated one yet.
    // A day that does not exist cannot come out of a calendar at all; that guard lives in
    // `isCalendarDate` and is tested against `listingChangelog` directly.
    const onSubmit = vi.fn();
    show({ onSubmit, entry: { title: 'Update 1', body: 'Something changed.', date: '' } });

    fireEvent.click(submit());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('hands nothing back when it is cancelled', () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    show({ onSubmit, onOpenChange });

    fill({ title: 'Update 1', body: 'Something changed.' });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
