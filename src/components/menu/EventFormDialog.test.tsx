import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { EventFormDialog } from './EventFormDialog';
import EventService from '@/services/EventService';
import { daysFrom, serverEvent } from '@/test/serverEvents';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 't', getCurrentUser: () => ({ id: 'a1', username: 'root-admin', accountType: 'admin' }) },
}));

// jsdom can't drive a real Lexical selection, and these cover the form's own logic rather than the
// editor's. The stub keeps each prose field a plain textarea so a value can be set; PromptField has its
// own tests. Recorded per field so the form's choice of editor is still asserted.
const promptFields = vi.hoisted(() => ({ byLabel: {} as Record<string, Record<string, unknown>> }));

vi.mock('@/components/prompt/PromptField', () => ({
  default: (props: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => {
    promptFields.byLabel[props.ariaLabel ?? ''] = props;
    return (
      <textarea
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  },
}));

const at = (offsetDays: number) => daysFrom(offsetDays);

const event = (over: Partial<ServerEvent> = {}): ServerEvent =>
  serverEvent({ title: 'Summer Isles Contest', startsAt: at(-4), endsAt: at(8), ...over });

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

/**
 * The themed picker holds a day and an hour apart, so a window is set as the pair an admin sets: open
 * the calendar, page forward to the month, press the day, then type the hour.
 */
const setMoment = (label: string, day: string, time: string) => {
  fireEvent.click(screen.getByRole('button', { name: `${label} date` }));

  const dayCell = () => screen.queryByRole('button', { name: new RegExp(day) });
  // The calendar opens on whatever month it was already showing, so page toward the target either way.
  const target = new Date(day.replace(/(\d+)(st|nd|rd|th)/, '$1')).getTime();
  const shown = () => new Date(`${screen.getByRole('grid').getAttribute('aria-label')} 1`).getTime();

  for (let paged = 0; paged < 36 && !dayCell(); paged++) {
    fireEvent.click(screen.getByRole('button', { name: target > shown() ? /Next Month/i : /Previous Month/i }));
  }

  fireEvent.click(dayCell()!);
  fireEvent.change(field(`${label} time`), { target: { value: time } });
};

/** Fill everything a new event needs, so a test can then change the one thing it is about. */
const fillValid = () => {
  type('Title', 'Autumn Hauntings Contest');
  type('Banner Text', 'Something stirs in the leaves.');
  type('Details', 'Enter by publishing a world with the switch on.');
  setMoment('Starts', 'October 1st, 2026', '12:00');
  setMoment('Ends', 'October 21st, 2026', '12:00');
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the type picker', () => {
  it('offers both types as one strip, neither of them a default hidden among the fields', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('tab', { name: /Contest/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Announcement/ })).toBeTruthy();
  });

  it('shows the rules field for a contest and drops it for an announcement', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);
    expect(screen.getByLabelText('Rules')).toBeTruthy();

    // Radix tab triggers act on mousedown, not click.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Announcement/ }));

    expect(screen.queryByLabelText('Rules')).toBeNull();
  });

  it('says which type an edit is instead of offering the choice, since the type can never change', () => {
    render(<EventFormDialog open onOpenChange={() => {}} editing={event()} />);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('Contest')).toBeTruthy();
  });
});

describe('scheduling one', () => {
  it('sends the authored fields with the window as instants', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    type('Rules', 'One entry per creator.');
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      type: 'contest',
      title: 'Autumn Hauntings Contest',
      rulesText: 'One entry per creator.',
    });
    expect(new Date(create.mock.calls[0][0].startsAt).toISOString())
      .toBe(new Date('2026-10-01T12:00').toISOString());
  });

  it('sends no rules on an announcement, which has none to have', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Announcement/ }));
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ type: 'announcement', rulesText: null });
  });

  it('refuses a window that runs backwards rather than letting the server say so', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    setMoment('Ends', 'September 1st, 2026', '12:00');
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    expect(create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('The end has to come after the start');
  });

  it('refuses an event with nothing to say', () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    expect(create).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('A title is required');
  });

  it('leaves the dialog open when the server refuses, so the draft is not lost', async () => {
    vi.spyOn(EventService, 'create').mockRejectedValue(new Error('That window overlaps the contest "Spring Tides"'));
    const onOpenChange = vi.fn();
    render(<EventFormDialog open onOpenChange={onOpenChange} />);

    fillValid();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That window overlaps the contest "Spring Tides"'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('editing one', () => {
  it('opens on what the event says now', () => {
    render(<EventFormDialog open onOpenChange={() => {}} editing={event()} />);

    expect(field('Title').value).toBe('Summer Isles Contest');
    expect((field('Rules') as unknown as HTMLTextAreaElement).value).toBe('One entry per creator.');
  });

  it('leaves a started event start alone, which the server would refuse to move', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} editing={event()} />);

    expect(screen.getByRole('button', { name: 'Starts date' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).not.toHaveProperty('startsAt');
    expect(update.mock.calls[0][1]).toHaveProperty('endsAt');
  });

  it('still moves the start of an event nobody has been told about', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    const scheduled = event({ startsAt: at(5), endsAt: at(20) });
    render(<EventFormDialog open onOpenChange={() => {}} editing={scheduled} />);

    expect(screen.getByRole('button', { name: 'Starts date' })).not.toBeDisabled();
    setMoment('Starts', 'November 1st, 2026', '12:00');
    setMoment('Ends', 'November 21st, 2026', '12:00');
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(new Date((update.mock.calls[0][1] as { startsAt: string }).startsAt).toISOString())
      .toBe(new Date('2026-11-01T12:00').toISOString());
  });

  it('closes and tells the list to re-read once the save lands', async () => {
    vi.spyOn(EventService, 'update').mockResolvedValue(event());
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    render(<EventFormDialog open onOpenChange={onOpenChange} editing={event()} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('the prose fields', () => {
  it('gives Details the markdown editor world prose is written in', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    expect(promptFields.byLabel.Details).toMatchObject({ markdown: true });
  });

  it('gives Rules the same editor, so contest rules can carry lists and headings', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    expect(promptFields.byLabel.Rules).toMatchObject({ markdown: true });
  });

  it('holds each to the length the server accepts', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    type('Details', 'x'.repeat(5000));

    expect(String((promptFields.byLabel.Details as { value: string }).value)).toHaveLength(4000);
  });
});

describe('styling the poster', () => {
  it('previews the band from what is in the form right now', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    type('Title', 'Autumn Hauntings Contest');
    fireEvent.change(field('Poster color'), { target: { value: '#7c3aed' } });

    const preview = screen.getByTestId('poster-preview');
    expect(preview.textContent).toContain('Autumn Hauntings Contest');
    expect(preview.querySelector<HTMLElement>('[style*="background-color"]')!.style.backgroundColor)
      .toBe('rgb(124, 58, 237)');
  });

  it('sends the chosen color with the event', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    fireEvent.change(field('Poster color'), { target: { value: '#7C3AED' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ posterColor: '#7c3aed' });
  });

  it('sends nothing styled when the organizer styled nothing', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ posterColor: null, posterImage: null });
  });

  it('puts the color back to the default on request', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    fireEvent.change(field('Poster color'), { target: { value: '#7c3aed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Default Color' }));
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ posterColor: null });
  });

  it('opens an edit on the styling the event already carries', () => {
    render(<EventFormDialog open onOpenChange={() => {}} editing={event({ posterColor: '#1e3a8a' })} />);

    expect(field('Poster color').value).toBe('#1e3a8a');
  });

  it('leaves stored artwork alone on an edit that never touched it', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} editing={event({ posterImageUrl: '/api/event-posters/a.webp' })} />);

    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    // Sending null here would delete the file the organizer never asked to remove.
    expect(update.mock.calls[0][1]).not.toHaveProperty('posterImage');
  });

  it('clears stored artwork when it is removed', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} editing={event({ posterImageUrl: '/api/event-posters/a.webp' })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Image' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toHaveProperty('posterImage', null);
  });

  it('refuses artwork the server would reject for its size, before uploading it', () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    const tooBig = new File([new Uint8Array(3 * 1024 * 1024)], 'band.png', { type: 'image/png' });
    fireEvent.change(field('Poster image'), { target: { files: [tooBig] } });

    expect(toast.error).toHaveBeenCalledWith('That image is larger than 2MB');
  });

  it('carries a picked image into the preview and the save', async () => {
    const create = vi.spyOn(EventService, 'create').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} />);

    fillValid();
    const art = new File(['art-bytes'], 'band.png', { type: 'image/png' });
    fireEvent.change(field('Poster image'), { target: { files: [art] } });

    await waitFor(() => expect(screen.getByTestId('poster-band-image')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Create Event/ }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(String(create.mock.calls[0][0].posterImage)).toMatch(/^data:image\/png;base64,/);
  });
});

describe('the band preview before a window is set', () => {
  it('names no dates, rather than showing a pill holding only its dash', async () => {
    render(<EventFormDialog open onOpenChange={() => {}} />);

    const preview = screen.getByTestId('poster-preview');
    expect(preview.textContent).not.toContain('–');

    setMoment('Starts', 'October 1st, 2026', '12:00');
    setMoment('Ends', 'October 21st, 2026', '12:00');

    expect(screen.getByTestId('poster-preview').textContent).toContain('–');
  });
});
