import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast } from 'react-toastify';
import { EventFormDialog } from './EventFormDialog';
import EventService from '@/services/EventService';
import type { ServerEvent } from '@/types';

vi.mock('react-toastify', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

vi.mock('@/services/AuthService', () => ({
  default: { token: 't', getCurrentUser: () => ({ id: 'a1', username: 'root-admin', accountType: 'admin' }) },
}));

const day = 86_400_000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const event = (over: Partial<ServerEvent> = {}): ServerEvent => ({
  id: 'e1',
  type: 'contest',
  title: 'Summer Isles Contest',
  bannerText: 'Enter by September.',
  body: 'Build a world among the Summer Isles.',
  rulesText: 'One entry per creator.',
  startsAt: at(-4),
  endsAt: at(8),
  cancelledAt: null,
  startMessageId: 'm1',
  endMessageId: null,
  winnerMessageId: null,
  winnerWorldId: null,
  winnerName: null,
  winnerAuthorName: null,
  ...over,
});

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

/** Fill everything a new event needs, so a test can then change the one thing it is about. */
const fillValid = () => {
  type('Title', 'Autumn Hauntings Contest');
  type('Banner Text', 'Something stirs in the leaves.');
  type('Details', 'Enter by publishing a world with the switch on.');
  type('Starts', '2026-10-01T12:00');
  type('Ends', '2026-10-21T12:00');
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
    type('Ends', '2026-09-01T12:00');
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
    expect(field('Rules').value).toBe('One entry per creator.');
  });

  it('leaves a started event start alone, which the server would refuse to move', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    render(<EventFormDialog open onOpenChange={() => {}} editing={event()} />);

    expect(field('Starts').readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Save Event/ }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).not.toHaveProperty('startsAt');
    expect(update.mock.calls[0][1]).toHaveProperty('endsAt');
  });

  it('still moves the start of an event nobody has been told about', async () => {
    const update = vi.spyOn(EventService, 'update').mockResolvedValue(event());
    const scheduled = event({ startsAt: at(5), endsAt: at(20) });
    render(<EventFormDialog open onOpenChange={() => {}} editing={scheduled} />);

    expect(field('Starts').readOnly).toBe(false);
    type('Starts', '2026-11-01T12:00');
    type('Ends', '2026-11-21T12:00');
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
